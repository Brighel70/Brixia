-- =============================================================================
-- 049 - Chiusura e riapertura esercizio contabile
--
-- RPC protette: open / start_closing / close / reopen
-- Snapshot consuntivo + prima nota alla chiusura
-- Blocco write su esercizio closed; durante closing solo sblocco checklist
-- Fee sync: solo esercizi open
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Snapshot chiusura
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_year_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  kind text NOT NULL
    CHECK (kind IN ('consuntivo_final', 'prima_nota_final', 'closing_checklist')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_fiscal_year_snapshots_kind_unique
    UNIQUE (fiscal_year_id, kind)
);

COMMENT ON TABLE public.accounting_fiscal_year_snapshots IS
  'Fotografia gestionale al momento della chiusura esercizio (non sostitutiva di bilanci civilistici).';

CREATE INDEX IF NOT EXISTS idx_accounting_fy_snapshots_fy
  ON public.accounting_fiscal_year_snapshots (fiscal_year_id);

ALTER TABLE public.accounting_fiscal_year_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_fy_snapshots_select ON public.accounting_fiscal_year_snapshots;
CREATE POLICY accounting_fy_snapshots_select ON public.accounting_fiscal_year_snapshots
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
    OR public.has_accounting_permission('accounting.close_period')
  );

REVOKE ALL ON TABLE public.accounting_fiscal_year_snapshots FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.accounting_fiscal_year_snapshots TO authenticated, service_role;
GRANT ALL ON TABLE public.accounting_fiscal_year_snapshots TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Protezione status esercizio: solo via RPC (GUC)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fiscal_years_protect_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND COALESCE(current_setting('accounting.fy_transition', true), '') <> 'on'
  THEN
    RAISE EXCEPTION
      'Le transizioni di stato dell''esercizio devono passare dalle RPC dedicate (open/close/reopen)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_fiscal_years_protect_status
  ON public.accounting_fiscal_years;
CREATE TRIGGER trg_accounting_fiscal_years_protect_status
  BEFORE UPDATE ON public.accounting_fiscal_years
  FOR EACH ROW
  EXECUTE FUNCTION public.accounting_fiscal_years_protect_status();

-- -----------------------------------------------------------------------------
-- 3) Blocco movimenti su esercizio chiuso
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_movements_require_writable_fy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_status text;
  v_fy_id uuid;
BEGIN
  v_fy_id := COALESCE(NEW.fiscal_year_id, OLD.fiscal_year_id);
  SELECT status INTO v_status
  FROM public.accounting_fiscal_years
  WHERE id = v_fy_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Esercizio contabile non trovato';
  END IF;

  IF v_status = 'closed' THEN
    RAISE EXCEPTION 'Esercizio chiuso: nessuna modifica ai movimenti consentita';
  END IF;

  IF TG_OP = 'INSERT' AND v_status <> 'open' THEN
    RAISE EXCEPTION 'Nuovi movimenti consentiti solo con esercizio aperto (stato attuale: %)', v_status;
  END IF;

  -- Durante closing: solo aggiornamenti a bozze esistenti / lifecycle, non nuovi insert
  IF TG_OP = 'UPDATE' AND v_status = 'closing' THEN
    NULL; -- consentito per sbloccare checklist (post/cancel/assign)
  END IF;

  IF v_status = 'draft' THEN
    RAISE EXCEPTION 'Esercizio in bozza: aprilo prima di registrare movimenti';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_movements_require_writable_fy
  ON public.accounting_movements;
CREATE TRIGGER trg_accounting_movements_require_writable_fy
  BEFORE INSERT OR UPDATE ON public.accounting_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.accounting_movements_require_writable_fy();

-- -----------------------------------------------------------------------------
-- 4) Fee sync: solo esercizio open
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
    AND fy.status = 'open'
  ORDER BY fy.starts_on DESC
  LIMIT 1;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fee_find_fiscal_year(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fee_find_fiscal_year(date) TO service_role;

-- -----------------------------------------------------------------------------
-- 5) Checklist chiusura
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fiscal_year_closing_checklist(
  p_fiscal_year_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_drafts int;
  v_pending int;
  v_docs_draft int;
  v_contracts_draft int;
  v_recon_open int;
  v_blocking boolean;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.view')
      OR public.has_accounting_permission('accounting.close_period')
    ) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;

  SELECT count(*)::int INTO v_drafts
  FROM public.accounting_movements
  WHERE fiscal_year_id = p_fiscal_year_id AND status = 'draft';

  SELECT count(*)::int INTO v_pending
  FROM public.accounting_movements
  WHERE fiscal_year_id = p_fiscal_year_id AND status = 'pending_account';

  IF to_regclass('public.accounting_commercial_documents') IS NOT NULL THEN
    SELECT count(*)::int INTO v_docs_draft
    FROM public.accounting_commercial_documents
    WHERE fiscal_year_id = p_fiscal_year_id AND status = 'draft';
  ELSE
    v_docs_draft := 0;
  END IF;

  IF to_regclass('public.accounting_sponsorship_contracts') IS NOT NULL THEN
    SELECT count(*)::int INTO v_contracts_draft
    FROM public.accounting_sponsorship_contracts
    WHERE fiscal_year_id = p_fiscal_year_id AND status = 'draft';
  ELSE
    v_contracts_draft := 0;
  END IF;

  -- Blocca solo se esistono sessioni incomplete (assenza sessioni = OK)
  IF to_regclass('public.accounting_reconciliation_sessions') IS NOT NULL THEN
    SELECT count(*)::int INTO v_recon_open
    FROM public.accounting_reconciliation_sessions
    WHERE fiscal_year_id = p_fiscal_year_id
      AND status IN ('draft', 'in_progress');
  ELSE
    v_recon_open := 0;
  END IF;

  v_blocking := (v_drafts + v_pending + v_docs_draft + v_contracts_draft + v_recon_open) > 0;

  RETURN jsonb_build_object(
    'fiscal_year_id', p_fiscal_year_id,
    'blocking', v_blocking,
    'draft_movements', v_drafts,
    'pending_account_movements', v_pending,
    'draft_commercial_documents', v_docs_draft,
    'draft_sponsorship_contracts', v_contracts_draft,
    'open_reconciliation_sessions', v_recon_open,
    'items', jsonb_build_array(
      jsonb_build_object('key', 'draft_movements', 'label', 'Bozze in prima nota', 'count', v_drafts, 'blocking', v_drafts > 0),
      jsonb_build_object('key', 'pending_account', 'label', 'Movimenti senza conto', 'count', v_pending, 'blocking', v_pending > 0),
      jsonb_build_object('key', 'draft_docs', 'label', 'Documenti commerciali in bozza', 'count', v_docs_draft, 'blocking', v_docs_draft > 0),
      jsonb_build_object('key', 'draft_contracts', 'label', 'Contratti sponsor in bozza', 'count', v_contracts_draft, 'blocking', v_contracts_draft > 0),
      jsonb_build_object('key', 'recon_open', 'label', 'Riconciliazioni incomplete', 'count', v_recon_open, 'blocking', v_recon_open > 0)
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 6) Build snapshot payload
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fiscal_year_build_snapshots(
  p_fiscal_year_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fy public.accounting_fiscal_years%ROWTYPE;
  v_consuntivo jsonb;
  v_prima_nota jsonb;
  v_checklist jsonb;
BEGIN
  SELECT * INTO v_fy FROM public.accounting_fiscal_years WHERE id = p_fiscal_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esercizio non trovato';
  END IF;

  v_checklist := public.accounting_fiscal_year_closing_checklist(p_fiscal_year_id);

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.movement_date, m.entry_no, m.created_at), '[]'::jsonb)
  INTO v_prima_nota
  FROM public.accounting_movements m
  WHERE m.fiscal_year_id = p_fiscal_year_id
    AND m.status IN ('posted', 'reversed', 'cancelled');

  SELECT jsonb_build_object(
    'fiscal_year', jsonb_build_object(
      'id', v_fy.id,
      'code', v_fy.code,
      'starts_on', v_fy.starts_on,
      'ends_on', v_fy.ends_on
    ),
    'totals', (
      SELECT jsonb_build_object(
        'income_cents', COALESCE(SUM(CASE WHEN direction = 'income' AND status = 'posted' THEN amount_cents ELSE 0 END), 0),
        'expense_cents', COALESCE(SUM(CASE WHEN direction = 'expense' AND status = 'posted' THEN amount_cents ELSE 0 END), 0),
        'posted_count', COALESCE(SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END), 0)
      )
      FROM public.accounting_movements
      WHERE fiscal_year_id = p_fiscal_year_id
    ),
    'by_account', (
      SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
      FROM (
        SELECT a.id, a.code, a.name, a.kind,
          COALESCE(SUM(
            CASE
              WHEN m.direction = 'income' THEN m.amount_cents
              WHEN m.direction = 'expense' THEN -m.amount_cents
              WHEN m.direction = 'transfer' AND m.account_id = a.id THEN -m.amount_cents
              WHEN m.direction = 'transfer' AND m.transfer_account_id = a.id THEN m.amount_cents
              ELSE 0
            END
          ), 0)::bigint AS net_cents
        FROM public.accounting_accounts a
        LEFT JOIN public.accounting_movements m
          ON m.status = 'posted'
          AND m.fiscal_year_id = p_fiscal_year_id
          AND (m.account_id = a.id OR m.transfer_account_id = a.id)
        GROUP BY a.id, a.code, a.name, a.kind
        ORDER BY a.code
      ) x
    ),
    'note', 'Snapshot gestionale TeamFlow — da validare con il commercialista. Non e'' un bilancio civilistico.'
  )
  INTO v_consuntivo;

  INSERT INTO public.accounting_fiscal_year_snapshots (
    fiscal_year_id, kind, payload, generated_by
  ) VALUES
    (p_fiscal_year_id, 'closing_checklist', v_checklist, auth.uid()),
    (p_fiscal_year_id, 'prima_nota_final', jsonb_build_object('movements', v_prima_nota), auth.uid()),
    (p_fiscal_year_id, 'consuntivo_final', v_consuntivo, auth.uid())
  ON CONFLICT (fiscal_year_id, kind) DO UPDATE
  SET
    payload = EXCLUDED.payload,
    generated_at = now(),
    generated_by = EXCLUDED.generated_by;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_fiscal_year_build_snapshots(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_fiscal_year_build_snapshots(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 7) Transizioni RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fiscal_year_open(
  p_fiscal_year_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fy public.accounting_fiscal_years%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.close_period')
      OR public.has_accounting_permission('accounting.manage_settings')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.close_period o manage_settings';
  END IF;

  SELECT * INTO v_fy FROM public.accounting_fiscal_years WHERE id = p_fiscal_year_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esercizio non trovato'; END IF;
  IF v_fy.status <> 'draft' THEN
    RAISE EXCEPTION 'Si puo'' aprire solo un esercizio in bozza (attuale: %)', v_fy.status;
  END IF;

  PERFORM set_config('accounting.fy_transition', 'on', true);

  UPDATE public.accounting_fiscal_years
  SET
    status = 'open',
    opened_at = now(),
    opened_by = auth.uid(),
    updated_by = auth.uid()
  WHERE id = p_fiscal_year_id;

  PERFORM public.accounting_audit_write(
    'accounting_fiscal_years', p_fiscal_year_id, 'fiscal_year_opened',
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'open'),
    NULL, 'ui'
  );

  RETURN p_fiscal_year_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fiscal_year_start_closing(
  p_fiscal_year_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fy public.accounting_fiscal_years%ROWTYPE;
  v_checklist jsonb;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.close_period')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.close_period';
  END IF;

  SELECT * INTO v_fy FROM public.accounting_fiscal_years WHERE id = p_fiscal_year_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esercizio non trovato'; END IF;
  IF v_fy.status <> 'open' THEN
    RAISE EXCEPTION 'Si puo'' avviare la chiusura solo da esercizio aperto (attuale: %)', v_fy.status;
  END IF;

  PERFORM set_config('accounting.fy_transition', 'on', true);

  UPDATE public.accounting_fiscal_years
  SET
    status = 'closing',
    closing_started_at = now(),
    closing_started_by = auth.uid(),
    updated_by = auth.uid()
  WHERE id = p_fiscal_year_id;

  v_checklist := public.accounting_fiscal_year_closing_checklist(p_fiscal_year_id);

  PERFORM public.accounting_audit_write(
    'accounting_fiscal_years', p_fiscal_year_id, 'fiscal_year_closing_started',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'closing', 'checklist', v_checklist),
    NULL, 'ui'
  );

  RETURN v_checklist;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fiscal_year_close(
  p_fiscal_year_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fy public.accounting_fiscal_years%ROWTYPE;
  v_checklist jsonb;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.close_period')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.close_period';
  END IF;

  SELECT * INTO v_fy FROM public.accounting_fiscal_years WHERE id = p_fiscal_year_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esercizio non trovato'; END IF;
  IF v_fy.status <> 'closing' THEN
    RAISE EXCEPTION 'Chiudi solo un esercizio in chiusura (attuale: %). Avvia prima la procedura.', v_fy.status;
  END IF;

  v_checklist := public.accounting_fiscal_year_closing_checklist(p_fiscal_year_id);
  IF COALESCE((v_checklist->>'blocking')::boolean, true) THEN
    RAISE EXCEPTION 'Checklist di chiusura non soddisfatta: %', v_checklist::text;
  END IF;

  PERFORM public.accounting_fiscal_year_build_snapshots(p_fiscal_year_id);

  PERFORM set_config('accounting.fy_transition', 'on', true);

  UPDATE public.accounting_fiscal_years
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid(),
    updated_by = auth.uid()
  WHERE id = p_fiscal_year_id;

  PERFORM public.accounting_audit_write(
    'accounting_fiscal_years', p_fiscal_year_id, 'fiscal_year_closed',
    jsonb_build_object('status', 'closing'),
    jsonb_build_object('status', 'closed', 'checklist', v_checklist),
    NULL, 'ui'
  );

  RETURN p_fiscal_year_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fiscal_year_reopen(
  p_fiscal_year_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fy public.accounting_fiscal_years%ROWTYPE;
  v_from text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticazione obbligatoria';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Motivazione obbligatoria per la riapertura';
  END IF;

  -- Super Admin o Admin (ruolo applicativo)
  IF NOT (public.is_super_admin() OR public.is_app_admin()) THEN
    RAISE EXCEPTION 'Riapertura consentita solo a Super Admin o Admin';
  END IF;

  SELECT * INTO v_fy FROM public.accounting_fiscal_years WHERE id = p_fiscal_year_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esercizio non trovato'; END IF;
  IF v_fy.status NOT IN ('closed', 'closing') THEN
    RAISE EXCEPTION 'Si puo'' riaprire solo un esercizio chiuso o in chiusura (attuale: %)', v_fy.status;
  END IF;

  v_from := v_fy.status;
  PERFORM set_config('accounting.fy_transition', 'on', true);

  UPDATE public.accounting_fiscal_years
  SET
    status = 'open',
    reopened_at = now(),
    reopened_by = auth.uid(),
    reopen_reason = btrim(p_reason),
    updated_by = auth.uid()
  WHERE id = p_fiscal_year_id;

  PERFORM public.accounting_audit_write(
    'accounting_fiscal_years',
    p_fiscal_year_id,
    'fiscal_year_reopened',
    jsonb_build_object('status', v_from),
    jsonb_build_object('status', 'open'),
    btrim(p_reason),
    'ui',
    NULL,
    jsonb_build_object(
      'extraordinary', true,
      'actor_is_super_admin', public.is_super_admin()
    )
  );

  RETURN p_fiscal_year_id;
END;
$$;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'accounting_fiscal_year_closing_checklist(uuid)',
    'accounting_fiscal_year_open(uuid)',
    'accounting_fiscal_year_start_closing(uuid)',
    'accounting_fiscal_year_close(uuid)',
    'accounting_fiscal_year_reopen(uuid,text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
