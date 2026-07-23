-- =============================================================================
-- 047 - Ciclo di vita operativo della Prima nota
--
-- Bozza manuale -> Contabilizzato
-- Bozza manuale -> Annullato
-- Contabilizzato manuale -> Stornato + movimento di storno tracciato
-- Incasso automatico senza conto -> Conto assegnato + Contabilizzato
-- Giroconto Cassa/Banca -> Bozza -> Contabilizzato
--
-- Tutte le transizioni passano da RPC SECURITY DEFINER: il client non puo'
-- modificare direttamente stati, numerazioni o storico contabile.
-- =============================================================================

BEGIN;

ALTER TABLE public.accounting_movements
  ADD COLUMN IF NOT EXISTS transfer_account_id uuid
    REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_movements_transfer_accounts_valid'
      AND conrelid = 'public.accounting_movements'::regclass
  ) THEN
    ALTER TABLE public.accounting_movements
      ADD CONSTRAINT accounting_movements_transfer_accounts_valid
      CHECK (
        transfer_account_id IS NULL
        OR (direction = 'transfer' AND transfer_account_id <> account_id)
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_accounting_movements_transfer_account
  ON public.accounting_movements(transfer_account_id)
  WHERE transfer_account_id IS NOT NULL;

-- Categoria tecnica necessaria per il vincolo category_id NOT NULL. Non appare
-- nei menu economici, nei preventivi o nei report: il giroconto non e' un costo
-- ne' un ricavo.
INSERT INTO public.accounting_categories (
  code,
  name,
  direction,
  default_nature,
  include_in_commercial_limit,
  is_system,
  is_active,
  recommended_active,
  sort_order,
  notes,
  group_id,
  available_in_movements,
  available_in_budget,
  available_in_reports
)
VALUES (
  'GIROCONTO',
  'Giroconti tra conti',
  'both',
  'to_classify',
  false,
  true,
  true,
  true,
  9999,
  'Categoria tecnica riservata ai trasferimenti tra Cassa e Banca. Non e'' una voce economica.',
  NULL,
  false,
  false,
  false
)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  direction = EXCLUDED.direction,
  default_nature = EXCLUDED.default_nature,
  include_in_commercial_limit = false,
  is_system = true,
  archived_at = NULL,
  available_in_movements = false,
  available_in_budget = false,
  available_in_reports = false,
  notes = EXCLUDED.notes,
  updated_at = now();

-- Numerazione progressiva per esercizio, protetta da advisory lock per evitare
-- che due contabilizzazioni contemporanee ricevano lo stesso numero.
CREATE OR REPLACE FUNCTION public.accounting_next_entry_no(p_fiscal_year_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_entry_no integer;
BEGIN
  IF p_fiscal_year_id IS NULL THEN
    RAISE EXCEPTION 'Esercizio contabile obbligatorio';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_fiscal_year_id::text));

  SELECT COALESCE(MAX(entry_no), 0) + 1
  INTO v_entry_no
  FROM public.accounting_movements
  WHERE fiscal_year_id = p_fiscal_year_id;

  RETURN v_entry_no;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_next_entry_no(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_next_entry_no(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.accounting_post_manual_movement(
  p_movement_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
  v_entry_no integer;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.post';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_movement.origin <> 'manual' THEN
    RAISE EXCEPTION 'Solo le bozze manuali possono essere contabilizzate da questa azione';
  END IF;
  IF v_movement.status NOT IN ('draft', 'pending_account') THEN
    RAISE EXCEPTION 'Il movimento non e'' una bozza contabilizzabile';
  END IF;
  IF v_movement.account_id IS NULL OR v_movement.category_id IS NULL
    OR v_movement.amount_cents <= 0 OR btrim(v_movement.description) = '' THEN
    RAISE EXCEPTION 'Completa conto, categoria, importo e descrizione prima di contabilizzare';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = v_movement.fiscal_year_id;

  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'La contabilizzazione e'' consentita solo in un esercizio aperto';
  END IF;
  IF v_movement.movement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on THEN
    RAISE EXCEPTION 'La data del movimento non appartiene all''esercizio selezionato';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_accounts
    WHERE id = v_movement.account_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Il conto selezionato non e'' attivo';
  END IF;

  IF v_movement.direction = 'transfer' THEN
    IF v_movement.transfer_account_id IS NULL
      OR v_movement.transfer_account_id = v_movement.account_id THEN
      RAISE EXCEPTION 'Per il giroconto seleziona un conto di destinazione diverso';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.accounting_accounts
      WHERE id = v_movement.transfer_account_id AND is_active IS TRUE
    ) THEN
      RAISE EXCEPTION 'Il conto di destinazione non e'' attivo';
    END IF;
  ELSIF v_movement.transfer_account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Il conto di destinazione e'' consentito solo per i giroconti';
  END IF;

  v_entry_no := public.accounting_next_entry_no(v_movement.fiscal_year_id);

  UPDATE public.accounting_movements
  SET
    status = 'posted',
    entry_no = v_entry_no,
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_movement.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement.id,
    'manual_movement_posted',
    jsonb_build_object('status', v_movement.status, 'entry_no', v_movement.entry_no),
    jsonb_build_object('status', 'posted', 'entry_no', v_entry_no),
    NULL,
    'ui',
    NULL,
    jsonb_build_object('movement_direction', v_movement.direction)
  );

  RETURN v_movement.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_cancel_manual_movement(
  p_movement_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.edit_draft';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_movement.origin <> 'manual' OR v_movement.status NOT IN ('draft', 'pending_account') THEN
    RAISE EXCEPTION 'Si possono annullare solo bozze manuali';
  END IF;

  UPDATE public.accounting_movements
  SET
    status = 'cancelled',
    notes = CASE
      WHEN NULLIF(btrim(p_reason), '') IS NULL THEN notes
      WHEN NULLIF(btrim(notes), '') IS NULL THEN 'Annullamento: ' || btrim(p_reason)
      ELSE notes || E'\nAnnullamento: ' || btrim(p_reason)
    END,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_movement.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement.id,
    'manual_movement_cancelled',
    jsonb_build_object('status', v_movement.status),
    jsonb_build_object('status', 'cancelled'),
    NULLIF(btrim(p_reason), ''),
    'ui'
  );

  RETURN v_movement.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reverse_manual_movement(
  p_movement_id uuid,
  p_reversal_date date,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_original public.accounting_movements%ROWTYPE;
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
  v_reversal_id uuid;
  v_entry_no integer;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.post';
  END IF;
  IF p_reversal_date IS NULL THEN
    RAISE EXCEPTION 'La data dello storno e'' obbligatoria';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Indica il motivo dello storno';
  END IF;

  SELECT * INTO v_original
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_original.origin <> 'manual' OR v_original.status <> 'posted' THEN
    RAISE EXCEPTION 'Si possono stornare solo movimenti manuali contabilizzati';
  END IF;
  IF v_original.reversed_by_movement_id IS NOT NULL THEN
    RAISE EXCEPTION 'Il movimento e'' gia'' stato stornato';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = v_original.fiscal_year_id;
  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'Lo storno e'' consentito solo in un esercizio aperto';
  END IF;
  IF p_reversal_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on THEN
    RAISE EXCEPTION 'La data dello storno non appartiene all''esercizio selezionato';
  END IF;

  v_entry_no := public.accounting_next_entry_no(v_original.fiscal_year_id);

  INSERT INTO public.accounting_movements (
    fiscal_year_id,
    entry_no,
    movement_date,
    settlement_date,
    direction,
    amount_cents,
    currency,
    account_id,
    transfer_account_id,
    category_id,
    description,
    notes,
    origin,
    status,
    payment_method_raw,
    reference,
    reverses_movement_id,
    created_by,
    updated_by,
    posted_at,
    posted_by
  ) VALUES (
    v_original.fiscal_year_id,
    v_entry_no,
    p_reversal_date,
    p_reversal_date,
    'reversal',
    v_original.amount_cents,
    v_original.currency,
    v_original.account_id,
    NULL,
    v_original.category_id,
    'Storno: ' || v_original.description,
    'Motivo storno: ' || btrim(p_reason),
    'reversal',
    'posted',
    v_original.payment_method_raw,
    v_original.reference,
    v_original.id,
    auth.uid(),
    auth.uid(),
    now(),
    auth.uid()
  )
  RETURNING id INTO v_reversal_id;

  UPDATE public.accounting_movements
  SET
    status = 'reversed',
    reversed_by_movement_id = v_reversal_id,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_original.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_original.id,
    'manual_movement_reversed',
    jsonb_build_object('status', 'posted'),
    jsonb_build_object('status', 'reversed', 'reversal_movement_id', v_reversal_id),
    btrim(p_reason),
    'ui'
  );
  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_reversal_id,
    'manual_reversal_created',
    NULL,
    jsonb_build_object('status', 'posted', 'reverses_movement_id', v_original.id, 'entry_no', v_entry_no),
    btrim(p_reason),
    'ui'
  );

  RETURN v_reversal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_assign_pending_account(
  p_movement_id uuid,
  p_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
  v_entry_no integer;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.post';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_movement.status <> 'pending_account' OR v_movement.origin NOT IN ('fee_sync', 'backfill') THEN
    RAISE EXCEPTION 'Questo movimento non richiede l''assegnazione di un conto';
  END IF;
  IF p_account_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.accounting_accounts WHERE id = p_account_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Seleziona un conto attivo';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = v_movement.fiscal_year_id;
  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'L''assegnazione del conto e'' consentita solo in un esercizio aperto';
  END IF;

  v_entry_no := public.accounting_next_entry_no(v_movement.fiscal_year_id);

  UPDATE public.accounting_movements
  SET
    account_id = p_account_id,
    status = 'posted',
    entry_no = v_entry_no,
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_movement.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement.id,
    'pending_account_assigned_and_posted',
    jsonb_build_object('status', 'pending_account', 'account_id', v_movement.account_id),
    jsonb_build_object('status', 'posted', 'account_id', p_account_id, 'entry_no', v_entry_no),
    NULL,
    'ui'
  );

  RETURN v_movement.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_create_manual_transfer(
  p_fiscal_year_id uuid,
  p_movement_date date,
  p_settlement_date date,
  p_amount_cents bigint,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_description text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
  v_category_id uuid;
  v_movement_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.create';
  END IF;
  IF p_movement_date IS NULL OR p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Data e importo positivo sono obbligatori';
  END IF;
  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL
    OR p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION 'Seleziona due conti diversi per il giroconto';
  END IF;
  IF NULLIF(btrim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'La descrizione del giroconto e'' obbligatoria';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = p_fiscal_year_id;
  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'I giroconti si possono creare solo in un esercizio aperto';
  END IF;
  IF p_movement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on
    OR (p_settlement_date IS NOT NULL AND p_settlement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on) THEN
    RAISE EXCEPTION 'La data del giroconto deve appartenere all''esercizio selezionato';
  END IF;
  IF (SELECT COUNT(*) FROM public.accounting_accounts WHERE id IN (p_source_account_id, p_destination_account_id) AND is_active IS TRUE) <> 2 THEN
    RAISE EXCEPTION 'I conti del giroconto devono essere entrambi attivi';
  END IF;

  SELECT id INTO v_category_id
  FROM public.accounting_categories
  WHERE code = 'GIROCONTO'
    AND archived_at IS NULL
  LIMIT 1;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Categoria tecnica GIROCONTO non disponibile';
  END IF;

  INSERT INTO public.accounting_movements (
    fiscal_year_id,
    movement_date,
    settlement_date,
    direction,
    amount_cents,
    currency,
    account_id,
    transfer_account_id,
    category_id,
    description,
    notes,
    origin,
    status,
    payment_method_raw,
    created_by,
    updated_by
  ) VALUES (
    p_fiscal_year_id,
    p_movement_date,
    p_settlement_date,
    'transfer',
    p_amount_cents,
    'EUR',
    p_source_account_id,
    p_destination_account_id,
    v_category_id,
    btrim(p_description),
    NULLIF(btrim(p_notes), ''),
    'manual',
    'draft',
    'transfer',
    auth.uid(),
    auth.uid()
  )
  RETURNING id INTO v_movement_id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement_id,
    'manual_transfer_created',
    NULL,
    jsonb_build_object(
      'status', 'draft',
      'source_account_id', p_source_account_id,
      'destination_account_id', p_destination_account_id,
      'amount_cents', p_amount_cents
    ),
    NULL,
    'ui'
  );

  RETURN v_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_update_manual_transfer(
  p_movement_id uuid,
  p_movement_date date,
  p_settlement_date date,
  p_amount_cents bigint,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_description text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.edit_draft';
  END IF;
  IF p_movement_date IS NULL OR p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Data e importo positivo sono obbligatori';
  END IF;
  IF p_source_account_id IS NULL OR p_destination_account_id IS NULL
    OR p_source_account_id = p_destination_account_id THEN
    RAISE EXCEPTION 'Seleziona due conti diversi per il giroconto';
  END IF;
  IF NULLIF(btrim(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'La descrizione del giroconto e'' obbligatoria';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;
  IF NOT FOUND OR v_movement.origin <> 'manual'
    OR v_movement.direction <> 'transfer'
    OR v_movement.status NOT IN ('draft', 'pending_account') THEN
    RAISE EXCEPTION 'Solo un giroconto manuale in bozza puo'' essere modificato';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = v_movement.fiscal_year_id;
  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'I giroconti si possono modificare solo in un esercizio aperto';
  END IF;
  IF p_movement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on
    OR (p_settlement_date IS NOT NULL AND p_settlement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on) THEN
    RAISE EXCEPTION 'La data del giroconto deve appartenere all''esercizio selezionato';
  END IF;
  IF (SELECT COUNT(*) FROM public.accounting_accounts WHERE id IN (p_source_account_id, p_destination_account_id) AND is_active IS TRUE) <> 2 THEN
    RAISE EXCEPTION 'I conti del giroconto devono essere entrambi attivi';
  END IF;

  UPDATE public.accounting_movements
  SET
    movement_date = p_movement_date,
    settlement_date = p_settlement_date,
    amount_cents = p_amount_cents,
    account_id = p_source_account_id,
    transfer_account_id = p_destination_account_id,
    description = btrim(p_description),
    notes = NULLIF(btrim(p_notes), ''),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_movement.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement.id,
    'manual_transfer_updated',
    jsonb_build_object('amount_cents', v_movement.amount_cents, 'source_account_id', v_movement.account_id, 'destination_account_id', v_movement.transfer_account_id),
    jsonb_build_object('amount_cents', p_amount_cents, 'source_account_id', p_source_account_id, 'destination_account_id', p_destination_account_id),
    NULL,
    'ui'
  );

  RETURN v_movement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_post_manual_movement(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_cancel_manual_movement(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_reverse_manual_movement(uuid, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_assign_pending_account(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_create_manual_transfer(uuid, date, date, bigint, uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accounting_update_manual_transfer(uuid, date, date, bigint, uuid, uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accounting_post_manual_movement(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_cancel_manual_movement(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_reverse_manual_movement(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_assign_pending_account(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_create_manual_transfer(uuid, date, date, bigint, uuid, uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accounting_update_manual_transfer(uuid, date, date, bigint, uuid, uuid, text, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
