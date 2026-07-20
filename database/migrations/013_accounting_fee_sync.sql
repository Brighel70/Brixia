-- =============================================================================
-- 013_accounting_fee_sync.sql
-- =============================================================================
-- STEP 2E — Sincronizzazione automatica Quote → Contabilità (fail-safe)
--
-- Crea:
--   - esercizio 2026 (idempotente)
--   - link_type payment_reversal
--   - accounting_sync_outbox
--   - audit writer interno
--   - processore eventi + sync assignment/payment/storno
--   - trigger AFTER su fee_assignments / payments (mai bloccanti)
--   - preview/apply riconciliazione + wrapper controllati
--
-- NON crea UI. NON modifica FlowMe / @brixia/shared / logica Quote app.
-- NON applica backfill storico.
-- Prerequisiti: 010 + 011 + 012 applicate.
-- FK Quote (schema Supabase reale): nessun ON DELETE CASCADE su
--   payments.assignment_id, fee_assignments.fee_id, fee_assignments.person_id.
--   L'app elimina assegnazioni senza cancellare prima i payments; con pagamenti
--   collegati la DELETE assegnazione fallisce (FK). voidPayment elimina solo payments.
-- NON APPLICARE senza revisione e approvazione.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Esercizio 2026
-- -----------------------------------------------------------------------------
INSERT INTO public.accounting_fiscal_years (
  code, starts_on, ends_on, status, currency, opening_notes
)
SELECT
  '2026',
  DATE '2026-01-01',
  DATE '2026-12-31',
  'open',
  'EUR',
  'creato per avvio modulo Contabilità TeamFlow'
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_fiscal_years WHERE code = '2026'
);

-- -----------------------------------------------------------------------------
-- 2) Estensione link_type: payment_reversal
-- Nomi constraint da 012 (verificati da test T11).
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_source_links
  DROP CONSTRAINT IF EXISTS accounting_source_links_link_type_check;

ALTER TABLE public.accounting_source_links
  DROP CONSTRAINT IF EXISTS accounting_source_links_type_targets;

ALTER TABLE public.accounting_source_links
  ADD CONSTRAINT accounting_source_links_link_type_check
  CHECK (link_type IN (
    'assignment_receivable',
    'payment_movement',
    'refund_movement',
    'legacy_receivable',
    'legacy_movement',
    'payment_reversal'
  ));

ALTER TABLE public.accounting_source_links
  ADD CONSTRAINT accounting_source_links_type_targets
  CHECK (
    (
      link_type IN ('assignment_receivable', 'legacy_receivable')
      AND receivable_id IS NOT NULL
      AND movement_id IS NULL
    )
    OR (
      link_type IN (
        'payment_movement',
        'refund_movement',
        'legacy_movement',
        'payment_reversal'
      )
      AND movement_id IS NOT NULL
      AND receivable_id IS NULL
    )
  );

COMMENT ON TABLE public.accounting_source_links IS
  'Mappa stabile sorgente→Contabilità. link_type include payment_reversal '
  '(storno pagamento: movement_id obbligatorio, receivable_id nullo). '
  'is_active: true solo se la sorgente Quote esiste ancora e il link è la mappa live; '
  'false = storico (sorgente eliminata/annullata). I link non si eliminano. '
  'payment_reversal è sempre storico (is_active=false): non esiste riga Quote per lo storno. '
  'La riconciliazione confronta solo link attivi assignment_receivable / payment_movement.';

-- -----------------------------------------------------------------------------
-- 3) accounting_sync_outbox
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'fees'
    CHECK (source_system = 'fees'),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  operation text NOT NULL
    CHECK (operation IN (
      'assignment_insert',
      'assignment_update',
      'assignment_delete',
      'payment_insert',
      'payment_delete'
    )),
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'processing',
      'processed',
      'failed',
      'ignored'
    )),
  attempts integer NOT NULL DEFAULT 0
    CHECK (attempts >= 0),
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz NULL,
  processed_at timestamptz NULL,
  next_retry_at timestamptz NULL,
  correlation_id uuid NULL,
  CONSTRAINT accounting_sync_outbox_dedupe_unique UNIQUE (dedupe_key)
);

COMMENT ON TABLE public.accounting_sync_outbox IS
  'Outbox fail-safe Quote→Contabilità. Payload minimo senza dati personali superflui. '
  'SELECT autenticato riservato a verify/manage_settings/Admin (payload completo).';

CREATE INDEX IF NOT EXISTS idx_accounting_sync_outbox_status
  ON public.accounting_sync_outbox (status);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_outbox_next_retry
  ON public.accounting_sync_outbox (next_retry_at);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_outbox_source
  ON public.accounting_sync_outbox (source_system, source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_outbox_created
  ON public.accounting_sync_outbox (created_at);

REVOKE ALL ON TABLE public.accounting_sync_outbox FROM anon;
REVOKE ALL ON TABLE public.accounting_sync_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_sync_outbox FROM authenticated;
GRANT SELECT ON TABLE public.accounting_sync_outbox TO authenticated;
GRANT ALL ON TABLE public.accounting_sync_outbox TO service_role;

ALTER TABLE public.accounting_sync_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_sync_outbox_select ON public.accounting_sync_outbox;
CREATE POLICY accounting_sync_outbox_select ON public.accounting_sync_outbox
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.verify')
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- -----------------------------------------------------------------------------
-- 4) Audit writer interno
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_audit_write(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_origin text DEFAULT 'fee_sync',
  p_correlation_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_origin text := COALESCE(NULLIF(btrim(p_origin), ''), 'fee_sync');
BEGIN
  IF p_entity_type IS NULL OR btrim(p_entity_type) = '' THEN
    RAISE EXCEPTION 'accounting_audit_write: entity_type obbligatorio';
  END IF;
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'accounting_audit_write: entity_id obbligatorio';
  END IF;
  IF p_action IS NULL OR btrim(p_action) = '' THEN
    RAISE EXCEPTION 'accounting_audit_write: action obbligatorio';
  END IF;
  IF v_origin NOT IN ('ui', 'database', 'fee_sync', 'backfill', 'reconcile', 'system') THEN
    v_origin := 'fee_sync';
  END IF;

  INSERT INTO public.accounting_audit_log (
    entity_type, entity_id, action, old_value, new_value,
    actor_profile_id, occurred_at, reason, origin, correlation_id, metadata
  ) VALUES (
    btrim(p_entity_type),
    p_entity_id,
    btrim(p_action),
    p_old_value,
    p_new_value,
    auth.uid(),
    now(),
    p_reason,
    v_origin,
    p_correlation_id,
    p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_audit_write(text, uuid, text, jsonb, jsonb, text, text, uuid, jsonb) IS
  'Writer interno audit Contabilità. SECURITY DEFINER. Non esposto ad anon/PUBLIC/authenticated.';

REVOKE ALL ON FUNCTION public.accounting_audit_write(text, uuid, text, jsonb, jsonb, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_audit_write(text, uuid, text, jsonb, jsonb, text, text, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_audit_write(text, uuid, text, jsonb, jsonb, text, text, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_audit_write(text, uuid, text, jsonb, jsonb, text, text, uuid, jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Helpers sync
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fee_find_fiscal_year(p_on date)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_on IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT fy.id
  INTO v_id
  FROM public.accounting_fiscal_years fy
  WHERE fy.starts_on <= p_on
    AND fy.ends_on >= p_on
    AND fy.status IN ('open', 'draft', 'closing')
  ORDER BY
    CASE fy.status WHEN 'open' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
    fy.starts_on DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_find_fiscal_year(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_fee_find_fiscal_year(date) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_fee_find_fiscal_year(date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_find_fiscal_year(date) TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_fee_quote_category_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT id FROM public.accounting_categories WHERE code = 'QUOTE' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_quote_category_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_fee_quote_category_id() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_fee_quote_category_id() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_quote_category_id() TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_fee_sum_payments(p_assignment_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(p.amount), 0)::bigint
  FROM public.payments p
  WHERE p.assignment_id = p_assignment_id;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_sum_payments(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_fee_sum_payments(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_fee_sum_payments(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_sum_payments(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_fee_receivable_status(
  p_expected bigint,
  p_collected bigint,
  p_assignment_status text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_assignment_status = 'cancelled' THEN
    IF COALESCE(p_collected, 0) > 0 THEN
      RETURN 'to_review';
    END IF;
    RETURN 'cancelled';
  END IF;

  IF COALESCE(p_collected, 0) <= 0 THEN
    RETURN 'assigned';
  ELSIF p_collected < p_expected THEN
    RETURN 'partially_paid';
  ELSIF p_collected = p_expected THEN
    RETURN 'paid';
  ELSE
    RETURN 'overpaid';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_receivable_status(bigint, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_fee_receivable_status(bigint, bigint, text) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_fee_receivable_status(bigint, bigint, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_receivable_status(bigint, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_fee_map_account(p_method text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT m.account_id
  FROM public.accounting_payment_method_account_map m
  WHERE m.is_active IS TRUE
    AND m.source_system = 'fees'
    AND lower(btrim(m.raw_payment_method)) = lower(btrim(COALESCE(p_method, '')))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_map_account(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_fee_map_account(text) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_fee_map_account(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_map_account(text) TO service_role;

-- -----------------------------------------------------------------------------
-- 6) Sync assignment / payment / delete handlers (interni)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fee_sync_assignment(p_payload jsonb, p_operation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := (p_payload->>'id')::uuid;
  v_person_id uuid := NULLIF(p_payload->>'person_id', '')::uuid;
  v_expected bigint := COALESCE((p_payload->>'amount')::bigint, 0);
  v_due date := NULLIF(p_payload->>'due_date', '')::date;
  v_asg_status text := NULLIF(p_payload->>'status', '');
  v_fy uuid;
  v_cat uuid;
  v_collected bigint;
  v_status text;
  v_recv_id uuid;
  v_desc text;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'assignment id mancante';
  END IF;

  v_fy := public.accounting_fee_find_fiscal_year(COALESCE(v_due, CURRENT_DATE));
  IF v_fy IS NULL THEN
    RAISE EXCEPTION 'esercizio contabile mancante per data %', COALESCE(v_due::text, 'oggi');
  END IF;

  v_cat := public.accounting_fee_quote_category_id();
  IF v_cat IS NULL THEN
    RAISE EXCEPTION 'categoria contabile QUOTE mancante';
  END IF;

  v_collected := public.accounting_fee_sum_payments(v_id);
  v_status := public.accounting_fee_receivable_status(v_expected, v_collected, v_asg_status);
  v_desc := format('Quota assegnazione %s', v_id);

  -- Trova link anche se inattivo (riattivazione se stessa assegnazione ripristinata).
  SELECT sl.receivable_id INTO v_recv_id
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.source_table = 'fee_assignments'
    AND sl.source_id = v_id
    AND sl.link_type = 'assignment_receivable'
  LIMIT 1;

  IF v_recv_id IS NULL THEN
    INSERT INTO public.accounting_receivables (
      fiscal_year_id, person_id, accounting_category_id,
      source_system, source_table, source_id, source_reference,
      expected_amount_cents, collected_amount_cents, refunded_amount_cents,
      currency, due_date, status, nature, include_in_commercial_limit,
      description
    ) VALUES (
      v_fy, v_person_id, v_cat,
      'fees', 'fee_assignments', v_id, p_payload->>'fee_id',
      v_expected, v_collected, 0,
      'EUR', v_due, v_status, 'institutional', false,
      v_desc
    )
    RETURNING id INTO v_recv_id;

    INSERT INTO public.accounting_source_links (
      source_system, source_table, source_id, link_type,
      receivable_id, movement_id, linked_at, is_active
    ) VALUES (
      'fees', 'fee_assignments', v_id, 'assignment_receivable',
      v_recv_id, NULL, now(), true
    )
    ON CONFLICT (source_system, source_table, source_id, link_type) DO UPDATE
      SET receivable_id = EXCLUDED.receivable_id,
          is_active = true,
          linked_at = now();

    PERFORM public.accounting_audit_write(
      'accounting_receivables', v_recv_id,
      CASE WHEN p_operation = 'assignment_insert' THEN 'fee_assignment_synced' ELSE 'fee_assignment_updated' END,
      NULL,
      jsonb_build_object(
        'expected_amount_cents', v_expected,
        'collected_amount_cents', v_collected,
        'status', v_status,
        'assignment_id', v_id
      ),
      NULL, 'fee_sync', NULL,
      jsonb_build_object('operation', p_operation)
    );
  ELSE
    UPDATE public.accounting_receivables r
    SET
      person_id = COALESCE(v_person_id, r.person_id),
      expected_amount_cents = v_expected,
      collected_amount_cents = v_collected,
      due_date = COALESCE(v_due, r.due_date),
      status = v_status,
      updated_at = now()
    WHERE r.id = v_recv_id;

    -- Riattiva link live se l'assegnazione Quote esiste di nuovo / è ancora presente.
    UPDATE public.accounting_source_links
    SET is_active = true,
        linked_at = now()
    WHERE source_system = 'fees'
      AND source_table = 'fee_assignments'
      AND source_id = v_id
      AND link_type = 'assignment_receivable'
      AND is_active IS DISTINCT FROM true;

    PERFORM public.accounting_audit_write(
      'accounting_receivables', v_recv_id,
      'fee_assignment_updated',
      NULL,
      jsonb_build_object(
        'expected_amount_cents', v_expected,
        'collected_amount_cents', v_collected,
        'status', v_status,
        'assignment_id', v_id
      ),
      NULL, 'fee_sync', NULL,
      jsonb_build_object('operation', p_operation)
    );
  END IF;

  RETURN jsonb_build_object('receivable_id', v_recv_id, 'status', v_status, 'collected', v_collected);
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fee_sync_assignment_delete(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := (p_payload->>'id')::uuid;
  v_recv_id uuid;
  v_collected bigint;
  v_status text;
BEGIN
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'assignment id mancante';
  END IF;

  SELECT sl.receivable_id INTO v_recv_id
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.source_table = 'fee_assignments'
    AND sl.source_id = v_id
    AND sl.link_type = 'assignment_receivable'
  LIMIT 1;

  IF v_recv_id IS NULL THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'receivable_not_found');
  END IF;

  SELECT r.collected_amount_cents INTO v_collected
  FROM public.accounting_receivables r
  WHERE r.id = v_recv_id;

  v_collected := COALESCE(v_collected, 0);
  -- Somma da payments al momento del trigger. Lo schema Supabase reale NON ha ON DELETE CASCADE
  -- su payments.assignment_id: se esistono pagamenti la DELETE assegnazione viene rifiutata (FK).
  -- L'app elimina l'assegnazione senza cancellare prima i payments (FeesTab, FeesManagement,
  -- useFeesData): con pagamenti presenti l'operazione Quote fallisce e questo trigger non parte.
  -- voidPayment elimina solo la riga payment (payment_delete prima di eventuale assignment_delete).
  v_collected := public.accounting_fee_sum_payments(v_id);

  IF v_collected > 0 THEN
    v_status := 'to_review';
  ELSE
    v_status := 'cancelled';
  END IF;

  UPDATE public.accounting_receivables
  SET
    collected_amount_cents = v_collected,
    status = v_status,
    updated_at = now()
  WHERE id = v_recv_id;

  -- Conserva il link storico; disattiva perché la sorgente Quote non esiste più.
  UPDATE public.accounting_source_links
  SET is_active = false
  WHERE source_system = 'fees'
    AND source_table = 'fee_assignments'
    AND source_id = v_id
    AND link_type = 'assignment_receivable'
    AND is_active IS DISTINCT FROM false;

  PERFORM public.accounting_audit_write(
    'accounting_receivables', v_recv_id,
    CASE WHEN v_status = 'cancelled' THEN 'fee_assignment_cancelled' ELSE 'fee_assignment_to_review' END,
    NULL,
    jsonb_build_object('status', v_status, 'collected_amount_cents', v_collected, 'assignment_id', v_id),
    'assignment_delete', 'fee_sync', NULL, NULL
  );

  RETURN jsonb_build_object('receivable_id', v_recv_id, 'status', v_status, 'link_active', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fee_sync_payment_insert(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pay_id uuid := (p_payload->>'id')::uuid;
  v_asg_id uuid := (p_payload->>'assignment_id')::uuid;
  v_amount bigint := COALESCE((p_payload->>'amount')::bigint, 0);
  v_method text := p_payload->>'payment_method';
  v_pay_date date := COALESCE(NULLIF(p_payload->>'payment_date', '')::date, CURRENT_DATE);
  v_ref text := p_payload->>'reference';
  v_mov_id uuid;
  v_link_active boolean;
  v_recv_id uuid;
  v_account uuid;
  v_cat uuid;
  v_fy uuid;
  v_status text;
  v_asg record;
  v_collected bigint;
  v_recv_status text;
BEGIN
  IF v_pay_id IS NULL OR v_asg_id IS NULL THEN
    RAISE EXCEPTION 'payment/assignment id mancante';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'importo pagamento non valido';
  END IF;

  SELECT sl.movement_id, sl.is_active
  INTO v_mov_id, v_link_active
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.source_table = 'payments'
    AND sl.source_id = v_pay_id
    AND sl.link_type = 'payment_movement'
  LIMIT 1;

  IF v_mov_id IS NOT NULL THEN
    IF COALESCE(v_link_active, false) THEN
      RETURN jsonb_build_object('idempotent', true, 'movement_id', v_mov_id);
    END IF;
    -- Link storico inattivo: pagamento già stornato (o UUID riutilizzato).
    -- Unique (source_system, source_table, source_id, link_type) impedisce un secondo
    -- payment_movement. Non riattivare e non alterare la storia contabile.
    RAISE EXCEPTION
      'payment_movement inattivo per payment %: storno già applicato o UUID riutilizzato; sync automatico non supportato',
      v_pay_id;
  END IF;

  SELECT * INTO v_asg FROM public.fee_assignments WHERE id = v_asg_id;
  IF NOT FOUND THEN
    -- assignment potrebbe essere stato già cancellato; usa payload minimo
    PERFORM public.accounting_fee_sync_assignment(
      jsonb_build_object(
        'id', v_asg_id,
        'amount', v_amount,
        'status', 'pending',
        'due_date', v_pay_date
      ),
      'assignment_update'
    );
  ELSE
    PERFORM public.accounting_fee_sync_assignment(
      jsonb_build_object(
        'id', v_asg.id,
        'fee_id', v_asg.fee_id,
        'person_id', v_asg.person_id,
        'amount', v_asg.amount,
        'status', v_asg.status,
        'due_date', v_asg.due_date,
        'installment_number', v_asg.installment_number,
        'installment_type', v_asg.installment_type,
        'created_at', v_asg.created_at,
        'updated_at', v_asg.updated_at
      ),
      'assignment_update'
    );
  END IF;

  SELECT sl.receivable_id INTO v_recv_id
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.source_table = 'fee_assignments'
    AND sl.source_id = v_asg_id
    AND sl.link_type = 'assignment_receivable'
    AND sl.is_active IS TRUE
  LIMIT 1;

  IF v_recv_id IS NULL THEN
    RAISE EXCEPTION 'receivable mancante per assignment %', v_asg_id;
  END IF;

  SELECT r.fiscal_year_id INTO v_fy
  FROM public.accounting_receivables r WHERE r.id = v_recv_id;

  v_cat := public.accounting_fee_quote_category_id();
  v_account := public.accounting_fee_map_account(v_method);
  IF v_account IS NULL THEN
    v_status := 'pending_account';
  ELSE
    v_status := 'posted';
  END IF;

  INSERT INTO public.accounting_movements (
    fiscal_year_id, movement_date, settlement_date, direction,
    amount_cents, currency, account_id, category_id, receivable_id,
    description, origin, status, payment_method_raw, reference,
    posted_at
  ) VALUES (
    v_fy, v_pay_date, v_pay_date, 'income',
    v_amount, 'EUR', v_account, v_cat, v_recv_id,
    format('Incasso quota pagamento %s', v_pay_id),
    'fee_sync', v_status, v_method, v_ref,
    CASE WHEN v_status = 'posted' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_mov_id;

  INSERT INTO public.accounting_source_links (
    source_system, source_table, source_id, link_type,
    receivable_id, movement_id, linked_at, is_active
  ) VALUES (
    'fees', 'payments', v_pay_id, 'payment_movement',
    NULL, v_mov_id, now(), true
  )
  ON CONFLICT (source_system, source_table, source_id, link_type) DO NOTHING;

  v_collected := public.accounting_fee_sum_payments(v_asg_id);
  SELECT public.accounting_fee_receivable_status(
    r.expected_amount_cents, v_collected, NULL
  )
  INTO v_recv_status
  FROM public.accounting_receivables r
  WHERE r.id = v_recv_id;

  UPDATE public.accounting_receivables
  SET collected_amount_cents = v_collected,
      status = v_recv_status,
      updated_at = now()
  WHERE id = v_recv_id;

  PERFORM public.accounting_audit_write(
    'accounting_movements', v_mov_id, 'fee_payment_synced',
    NULL,
    jsonb_build_object(
      'payment_id', v_pay_id,
      'amount_cents', v_amount,
      'movement_status', v_status,
      'receivable_id', v_recv_id
    ),
    NULL, 'fee_sync', NULL, NULL
  );

  RETURN jsonb_build_object('movement_id', v_mov_id, 'receivable_id', v_recv_id, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fee_sync_payment_delete(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_pay_id uuid := (p_payload->>'id')::uuid;
  v_asg_id uuid := (p_payload->>'assignment_id')::uuid;
  v_amount bigint := COALESCE((p_payload->>'amount')::bigint, 0);
  v_orig uuid;
  v_rev uuid;
  v_recv_id uuid;
  v_orig_row public.accounting_movements%ROWTYPE;
  v_collected bigint;
  v_recv_status text;
  v_status text;
BEGIN
  IF v_pay_id IS NULL THEN
    RAISE EXCEPTION 'payment id mancante';
  END IF;

  SELECT sl.movement_id INTO v_orig
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.source_table = 'payments'
    AND sl.source_id = v_pay_id
    AND sl.link_type = 'payment_movement'
  LIMIT 1;

  IF v_orig IS NULL THEN
    RAISE EXCEPTION 'movimento originale non trovato per payment %', v_pay_id;
  END IF;

  SELECT sl.movement_id INTO v_rev
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.source_table = 'payments'
    AND sl.source_id = v_pay_id
    AND sl.link_type = 'payment_reversal'
  LIMIT 1;

  IF v_rev IS NOT NULL THEN
    -- Idempotenza: assicurare che payment_movement resti inattivo.
    UPDATE public.accounting_source_links
    SET is_active = false
    WHERE source_system = 'fees'
      AND source_table = 'payments'
      AND source_id = v_pay_id
      AND link_type = 'payment_movement'
      AND is_active IS DISTINCT FROM false;

    RETURN jsonb_build_object('idempotent', true, 'reversal_movement_id', v_rev);
  END IF;

  SELECT * INTO v_orig_row FROM public.accounting_movements WHERE id = v_orig;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'movimento % assente', v_orig;
  END IF;

  v_recv_id := v_orig_row.receivable_id;
  IF v_orig_row.account_id IS NULL THEN
    v_status := 'pending_account';
  ELSE
    v_status := 'posted';
  END IF;

  INSERT INTO public.accounting_movements (
    fiscal_year_id, movement_date, settlement_date, direction,
    amount_cents, currency, account_id, category_id, receivable_id,
    description, origin, status, payment_method_raw, reference,
    reverses_movement_id, posted_at
  ) VALUES (
    v_orig_row.fiscal_year_id,
    CURRENT_DATE,
    CURRENT_DATE,
    'reversal',
    COALESCE(NULLIF(v_amount, 0), v_orig_row.amount_cents),
    'EUR',
    v_orig_row.account_id,
    v_orig_row.category_id,
    v_recv_id,
    format('Storno pagamento %s', v_pay_id),
    'reversal',
    v_status,
    v_orig_row.payment_method_raw,
    v_orig_row.reference,
    v_orig,
    CASE WHEN v_status = 'posted' THEN now() ELSE NULL END
  )
  RETURNING id INTO v_rev;

  UPDATE public.accounting_movements
  SET status = 'reversed',
      reversed_by_movement_id = v_rev,
      updated_at = now()
  WHERE id = v_orig;

  -- Sorgente Quote eliminata: payment_movement resta storico ma non live.
  UPDATE public.accounting_source_links
  SET is_active = false
  WHERE source_system = 'fees'
    AND source_table = 'payments'
    AND source_id = v_pay_id
    AND link_type = 'payment_movement';

  -- payment_reversal: link storico (nessuna riga Quote per lo storno) → is_active=false.
  INSERT INTO public.accounting_source_links (
    source_system, source_table, source_id, link_type,
    receivable_id, movement_id, linked_at, is_active
  ) VALUES (
    'fees', 'payments', v_pay_id, 'payment_reversal',
    NULL, v_rev, now(), false
  )
  ON CONFLICT (source_system, source_table, source_id, link_type) DO UPDATE
    SET movement_id = EXCLUDED.movement_id,
        is_active = false,
        linked_at = now();

  IF v_recv_id IS NOT NULL AND v_asg_id IS NOT NULL THEN
    v_collected := public.accounting_fee_sum_payments(v_asg_id);
    SELECT public.accounting_fee_receivable_status(r.expected_amount_cents, v_collected, NULL)
    INTO v_recv_status
    FROM public.accounting_receivables r
    WHERE r.id = v_recv_id;

    UPDATE public.accounting_receivables
    SET collected_amount_cents = v_collected,
        status = v_recv_status,
        updated_at = now()
    WHERE id = v_recv_id;
  END IF;

  PERFORM public.accounting_audit_write(
    'accounting_movements', v_rev, 'fee_payment_reversed',
    jsonb_build_object('original_movement_id', v_orig),
    jsonb_build_object('reversal_movement_id', v_rev, 'payment_id', v_pay_id),
    'payment_delete', 'fee_sync', NULL, NULL
  );

  RETURN jsonb_build_object(
    'original_movement_id', v_orig,
    'reversal_movement_id', v_rev,
    'receivable_id', v_recv_id,
    'payment_movement_active', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_sync_assignment(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accounting_fee_sync_assignment_delete(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accounting_fee_sync_payment_insert(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accounting_fee_sync_payment_delete(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_sync_assignment(jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.accounting_fee_sync_assignment_delete(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.accounting_fee_sync_payment_insert(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.accounting_fee_sync_payment_delete(jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 7) Processore outbox
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fee_process_outbox_row(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r public.accounting_sync_outbox%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO r
  FROM public.accounting_sync_outbox
  WHERE id = p_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'not_found_or_locked');
  END IF;

  IF r.status = 'processed' THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_processed');
  END IF;

  UPDATE public.accounting_sync_outbox
  SET status = 'processing',
      attempts = attempts + 1,
      processing_started_at = now()
  WHERE id = r.id;

  BEGIN
    CASE r.operation
      WHEN 'assignment_insert' THEN
        v_result := public.accounting_fee_sync_assignment(r.payload, r.operation);
      WHEN 'assignment_update' THEN
        v_result := public.accounting_fee_sync_assignment(r.payload, r.operation);
      WHEN 'assignment_delete' THEN
        v_result := public.accounting_fee_sync_assignment_delete(r.payload);
      WHEN 'payment_insert' THEN
        v_result := public.accounting_fee_sync_payment_insert(r.payload);
      WHEN 'payment_delete' THEN
        v_result := public.accounting_fee_sync_payment_delete(r.payload);
      ELSE
        RAISE EXCEPTION 'operazione sconosciuta %', r.operation;
    END CASE;

    UPDATE public.accounting_sync_outbox
    SET status = 'processed',
        processed_at = now(),
        last_error = NULL,
        next_retry_at = NULL
    WHERE id = r.id;

    RETURN jsonb_build_object('ok', true, 'result', v_result);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.accounting_sync_outbox
    SET status = 'failed',
        last_error = SQLSTATE || ': ' || SQLERRM,
        next_retry_at = now() + interval '5 minutes'
    WHERE id = r.id;

    BEGIN
      PERFORM public.accounting_audit_write(
        'accounting_sync_outbox', r.id, 'fee_sync_failed',
        NULL,
        jsonb_build_object('operation', r.operation, 'source_id', r.source_id),
        SQLERRM, 'fee_sync', r.correlation_id,
        jsonb_build_object('sqlstate', SQLSTATE)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- audit best-effort
    END;

    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_process_outbox_row(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_process_outbox_row(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_fee_enqueue_and_try(
  p_source_table text,
  p_source_id uuid,
  p_operation text,
  p_dedupe_key text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.accounting_sync_outbox (
    source_system, source_table, source_id, operation, dedupe_key, payload, status
  ) VALUES (
    'fees', p_source_table, p_source_id, p_operation, p_dedupe_key, p_payload, 'pending'
  )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET payload = EXCLUDED.payload,
        status = CASE
          WHEN public.accounting_sync_outbox.status IN ('processed', 'processing')
            THEN public.accounting_sync_outbox.status
          ELSE 'pending'
        END,
        last_error = CASE
          WHEN public.accounting_sync_outbox.status = 'processed'
            THEN public.accounting_sync_outbox.last_error
          ELSE NULL
        END
  RETURNING id INTO v_id;

  -- tentativo immediato; errori gestiti nel processore (non propagati)
  PERFORM public.accounting_fee_process_outbox_row(v_id);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_enqueue_and_try(text, uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_enqueue_and_try(text, uuid, text, text, jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- 8) Trigger functions fail-safe (mai bloccanti per Quote)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_trg_fee_assignments_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payload jsonb;
  v_op text;
  v_key text;
  v_hash text;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_op := 'assignment_delete';
      v_payload := jsonb_build_object(
        'id', OLD.id,
        'fee_id', OLD.fee_id,
        'person_id', OLD.person_id,
        'amount', OLD.amount,
        'status', OLD.status,
        'due_date', OLD.due_date,
        'installment_number', OLD.installment_number,
        'installment_type', OLD.installment_type,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at,
        'operation', v_op
      );
      v_key := 'fees:fee_assignments:' || OLD.id::text || ':assignment_delete';
      PERFORM public.accounting_fee_enqueue_and_try('fee_assignments', OLD.id, v_op, v_key, v_payload);
      RETURN OLD;
    END IF;

    v_payload := jsonb_build_object(
      'id', NEW.id,
      'fee_id', NEW.fee_id,
      'person_id', NEW.person_id,
      'amount', NEW.amount,
      'status', NEW.status,
      'due_date', NEW.due_date,
      'installment_number', NEW.installment_number,
      'installment_type', NEW.installment_type,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at,
      'operation', CASE WHEN TG_OP = 'INSERT' THEN 'assignment_insert' ELSE 'assignment_update' END
    );

    IF TG_OP = 'INSERT' THEN
      v_op := 'assignment_insert';
      v_key := 'fees:fee_assignments:' || NEW.id::text || ':assignment_insert';
    ELSE
      v_op := 'assignment_update';
      v_hash := md5(
        COALESCE(NEW.amount::text, '') || '|' ||
        COALESCE(NEW.status, '') || '|' ||
        COALESCE(NEW.due_date::text, '') || '|' ||
        COALESCE(NEW.person_id::text, '') || '|' ||
        COALESCE(NEW.installment_number::text, '') || '|' ||
        COALESCE(NEW.installment_type, '')
      );
      v_key := 'fees:fee_assignments:' || NEW.id::text || ':assignment_update:' || v_hash;
    END IF;

    PERFORM public.accounting_fee_enqueue_and_try('fee_assignments', NEW.id, v_op, v_key, v_payload);
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accounting fee_assignments sync failed: % %', SQLSTATE, SQLERRM;
    BEGIN
      INSERT INTO public.accounting_sync_outbox (
        source_system, source_table, source_id, operation, dedupe_key, payload,
        status, attempts, last_error
      ) VALUES (
        'fees',
        'fee_assignments',
        COALESCE(NEW.id, OLD.id),
        COALESCE(
          v_op,
          CASE TG_OP
            WHEN 'DELETE' THEN 'assignment_delete'
            WHEN 'INSERT' THEN 'assignment_insert'
            ELSE 'assignment_update'
          END
        ),
        'fees:fee_assignments:failsafe:' || COALESCE(NEW.id, OLD.id)::text || ':' ||
          COALESCE(v_op, TG_OP) || ':' || md5(SQLSTATE || SQLERRM || clock_timestamp()::text),
        COALESCE(v_payload, jsonb_build_object('id', COALESCE(NEW.id, OLD.id), 'operation', TG_OP)),
        'failed',
        1,
        SQLSTATE || ': ' || SQLERRM
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_trg_payments_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payload jsonb;
  v_op text;
  v_key text;
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_op := 'payment_delete';
      v_payload := jsonb_build_object(
        'id', OLD.id,
        'assignment_id', OLD.assignment_id,
        'amount', OLD.amount,
        'payment_method', OLD.payment_method,
        'payment_date', OLD.payment_date,
        'reference', OLD.reference,
        'created_at', OLD.created_at,
        'operation', v_op
      );
      v_key := 'fees:payments:' || OLD.id::text || ':payment_delete';
      PERFORM public.accounting_fee_enqueue_and_try('payments', OLD.id, v_op, v_key, v_payload);
      RETURN OLD;
    END IF;

    v_op := 'payment_insert';
    v_payload := jsonb_build_object(
      'id', NEW.id,
      'assignment_id', NEW.assignment_id,
      'amount', NEW.amount,
      'payment_method', NEW.payment_method,
      'payment_date', NEW.payment_date,
      'reference', NEW.reference,
      'created_at', NEW.created_at,
      'operation', v_op
    );
    v_key := 'fees:payments:' || NEW.id::text || ':payment_insert';
    PERFORM public.accounting_fee_enqueue_and_try('payments', NEW.id, v_op, v_key, v_payload);
    RETURN NEW;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'accounting payments sync failed: % %', SQLSTATE, SQLERRM;
    BEGIN
      INSERT INTO public.accounting_sync_outbox (
        source_system, source_table, source_id, operation, dedupe_key, payload,
        status, attempts, last_error
      ) VALUES (
        'fees',
        'payments',
        COALESCE(NEW.id, OLD.id),
        COALESCE(v_op, CASE WHEN TG_OP = 'DELETE' THEN 'payment_delete' ELSE 'payment_insert' END),
        'fees:payments:failsafe:' || COALESCE(NEW.id, OLD.id)::text || ':' ||
          COALESCE(v_op, TG_OP) || ':' || md5(SQLSTATE || SQLERRM || clock_timestamp()::text),
        COALESCE(v_payload, jsonb_build_object('id', COALESCE(NEW.id, OLD.id), 'operation', TG_OP)),
        'failed',
        1,
        SQLSTATE || ': ' || SQLERRM
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_trg_fee_assignments_sync() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accounting_trg_payments_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_trg_fee_assignments_sync() TO service_role;
GRANT EXECUTE ON FUNCTION public.accounting_trg_payments_sync() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_fee_assignments_sync ON public.fee_assignments;
CREATE TRIGGER trg_accounting_fee_assignments_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.fee_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.accounting_trg_fee_assignments_sync();

DROP TRIGGER IF EXISTS trg_accounting_payments_sync ON public.payments;
CREATE TRIGGER trg_accounting_payments_sync
  AFTER INSERT OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.accounting_trg_payments_sync();

-- -----------------------------------------------------------------------------
-- 9) Wrapper esposti + riconciliazione
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_process_pending_sync(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  r record;
  v_ok int := 0;
  v_fail int := 0;
  v_res jsonb;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.verify')
  ) THEN
    RAISE EXCEPTION 'permesso negato: accounting.verify o Admin richiesti';
  END IF;

  FOR r IN
    SELECT id
    FROM public.accounting_sync_outbox
    WHERE status IN ('pending', 'failed')
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at
    LIMIT v_lim
  LOOP
    v_res := public.accounting_fee_process_outbox_row(r.id);
    IF COALESCE((v_res->>'ok')::boolean, false) THEN
      v_ok := v_ok + 1;
    ELSE
      v_fail := v_fail + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('processed_ok', v_ok, 'processed_failed', v_fail, 'limit', v_lim);
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconcile_fees_preview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_asg int;
  v_pay int;
  v_active_asg_links int;
  v_active_pay_links int;
  v_asg_missing_link int;
  v_asg_orphan_link int;
  v_pay_missing_link int;
  v_pay_orphan_link int;
  v_collected_mismatch int;
  v_pending int;
  v_failed int;
  v_aligned boolean;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
    OR public.has_accounting_permission('accounting.verify')
  ) THEN
    RAISE EXCEPTION 'permesso negato';
  END IF;

  SELECT COUNT(*)::int INTO v_asg FROM public.fee_assignments;
  SELECT COUNT(*)::int INTO v_pay FROM public.payments;

  SELECT COUNT(*)::int INTO v_active_asg_links
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.link_type = 'assignment_receivable'
    AND sl.is_active IS TRUE;

  SELECT COUNT(*)::int INTO v_active_pay_links
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.link_type = 'payment_movement'
    AND sl.is_active IS TRUE;

  -- Assegnazioni attuali senza link assignment_receivable attivo
  SELECT COUNT(*)::int INTO v_asg_missing_link
  FROM public.fee_assignments fa
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.accounting_source_links sl
    WHERE sl.source_system = 'fees'
      AND sl.source_table = 'fee_assignments'
      AND sl.source_id = fa.id
      AND sl.link_type = 'assignment_receivable'
      AND sl.is_active IS TRUE
  );

  -- Link assignment_receivable attivi senza assegnazione Quote
  SELECT COUNT(*)::int INTO v_asg_orphan_link
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.link_type = 'assignment_receivable'
    AND sl.is_active IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.fee_assignments fa WHERE fa.id = sl.source_id
    );

  -- Pagamenti attuali senza link payment_movement attivo
  SELECT COUNT(*)::int INTO v_pay_missing_link
  FROM public.payments p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.accounting_source_links sl
    WHERE sl.source_system = 'fees'
      AND sl.source_table = 'payments'
      AND sl.source_id = p.id
      AND sl.link_type = 'payment_movement'
      AND sl.is_active IS TRUE
  );

  -- Link payment_movement attivi senza pagamento Quote
  -- (payment_reversal non conta: non è un pagamento attivo)
  SELECT COUNT(*)::int INTO v_pay_orphan_link
  FROM public.accounting_source_links sl
  WHERE sl.source_system = 'fees'
    AND sl.link_type = 'payment_movement'
    AND sl.is_active IS TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.id = sl.source_id
    );

  -- collected_amount_cents incoerente con SUM(payments) per receivable di assegnazioni esistenti
  SELECT COUNT(*)::int INTO v_collected_mismatch
  FROM public.accounting_source_links sl
  JOIN public.accounting_receivables r ON r.id = sl.receivable_id
  JOIN public.fee_assignments fa ON fa.id = sl.source_id
  WHERE sl.source_system = 'fees'
    AND sl.link_type = 'assignment_receivable'
    AND sl.is_active IS TRUE
    AND r.collected_amount_cents IS DISTINCT FROM (
      SELECT COALESCE(SUM(p.amount), 0)::bigint
      FROM public.payments p
      WHERE p.assignment_id = fa.id
    );

  SELECT COUNT(*)::int INTO v_pending
  FROM public.accounting_sync_outbox WHERE status = 'pending';
  SELECT COUNT(*)::int INTO v_failed
  FROM public.accounting_sync_outbox WHERE status = 'failed';

  v_aligned := (
    v_asg_missing_link = 0
    AND v_asg_orphan_link = 0
    AND v_pay_missing_link = 0
    AND v_pay_orphan_link = 0
    AND v_collected_mismatch = 0
    AND v_pending = 0
    AND v_failed = 0
  );

  RETURN jsonb_build_object(
    'assignments_count', v_asg,
    'payments_count', v_pay,
    'active_assignment_links', v_active_asg_links,
    'active_payment_links', v_active_pay_links,
    'assignments_missing_active_link', v_asg_missing_link,
    'active_assignment_links_without_source', v_asg_orphan_link,
    'payments_missing_active_link', v_pay_missing_link,
    'active_payment_links_without_source', v_pay_orphan_link,
    'collected_mismatch_count', v_collected_mismatch,
    'outbox_pending', v_pending,
    'outbox_failed', v_failed,
    'aligned', v_aligned,
    'personal_data_included', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconcile_fees_apply()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  a record;
  p record;
  v_enqueued int := 0;
  v_process jsonb;
  v_preview jsonb;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.verify')
  ) THEN
    RAISE EXCEPTION 'permesso negato: accounting.verify o Admin richiesti';
  END IF;

  FOR a IN SELECT * FROM public.fee_assignments LOOP
    PERFORM public.accounting_fee_enqueue_and_try(
      'fee_assignments',
      a.id,
      'assignment_update',
      'fees:fee_assignments:' || a.id::text || ':reconcile:' || md5(
        COALESCE(a.amount::text,'') || '|' || COALESCE(a.status,'') || '|' || COALESCE(a.due_date::text,'')
      ),
      jsonb_build_object(
        'id', a.id,
        'fee_id', a.fee_id,
        'person_id', a.person_id,
        'amount', a.amount,
        'status', a.status,
        'due_date', a.due_date,
        'installment_number', a.installment_number,
        'installment_type', a.installment_type,
        'created_at', a.created_at,
        'updated_at', a.updated_at,
        'operation', 'assignment_update'
      )
    );
    v_enqueued := v_enqueued + 1;
  END LOOP;

  FOR p IN SELECT * FROM public.payments LOOP
    PERFORM public.accounting_fee_enqueue_and_try(
      'payments',
      p.id,
      'payment_insert',
      'fees:payments:' || p.id::text || ':payment_insert',
      jsonb_build_object(
        'id', p.id,
        'assignment_id', p.assignment_id,
        'amount', p.amount,
        'payment_method', p.payment_method,
        'payment_date', p.payment_date,
        'reference', p.reference,
        'created_at', p.created_at,
        'operation', 'payment_insert'
      )
    );
    v_enqueued := v_enqueued + 1;
  END LOOP;

  v_process := public.accounting_process_pending_sync(200);
  v_preview := public.accounting_reconcile_fees_preview();

  IF NOT COALESCE((v_preview->>'aligned')::boolean, false) THEN
    PERFORM public.accounting_audit_write(
      'accounting_sync_outbox', gen_random_uuid(), 'reconciliation_mismatch',
      NULL, jsonb_build_object('enqueued', v_enqueued, 'process', v_process, 'preview', v_preview),
      'reconcile_apply', 'reconcile', NULL, NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'enqueued', v_enqueued,
    'process', v_process,
    'preview', v_preview
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_process_pending_sync(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_reconcile_fees_preview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_reconcile_fees_apply() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_process_pending_sync(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_reconcile_fees_preview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_reconcile_fees_apply() TO authenticated, service_role;

COMMIT;
