-- =============================================================================
-- 048 - Riconciliazione banca e cassa
--
-- Sessioni di riconciliazione per conto/periodo, righe estratto conto,
-- abbinamento a movimenti TeamFlow, esclusione con motivazione.
-- Il saldo gestionale (prima nota) resta distinto dal saldo estratto.
-- Non modifica accounting_reconcile_fees_* (sync Quote).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Sessioni
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_reconciliation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL
    REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  opening_balance_cents bigint NOT NULL DEFAULT 0,
  closing_balance_statement_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  notes text NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_reconciliation_sessions_period_ok
    CHECK (period_end >= period_start)
);

COMMENT ON TABLE public.accounting_reconciliation_sessions IS
  'Sessioni di riconciliazione banca/cassa. Saldo estratto distinto dal netto gestionale.';

CREATE INDEX IF NOT EXISTS idx_accounting_recon_sessions_fy
  ON public.accounting_reconciliation_sessions (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_accounting_recon_sessions_account
  ON public.accounting_reconciliation_sessions (account_id);
CREATE INDEX IF NOT EXISTS idx_accounting_recon_sessions_status
  ON public.accounting_reconciliation_sessions (status);

DROP TRIGGER IF EXISTS trg_accounting_recon_sessions_updated_at
  ON public.accounting_reconciliation_sessions;
CREATE TRIGGER trg_accounting_recon_sessions_updated_at
  BEFORE UPDATE ON public.accounting_reconciliation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) Righe estratto
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL
    REFERENCES public.accounting_reconciliation_sessions(id) ON DELETE CASCADE,
  line_date date NOT NULL,
  amount_cents bigint NOT NULL
    CHECK (amount_cents <> 0),
  description text NOT NULL DEFAULT '',
  reference text NULL,
  external_id text NULL,
  match_status text NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('unmatched', 'matched', 'excluded')),
  matched_movement_id uuid NULL
    REFERENCES public.accounting_movements(id) ON DELETE RESTRICT,
  exclude_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_bank_statement_lines_exclude_reason_ok
    CHECK (
      (match_status = 'excluded' AND NULLIF(btrim(exclude_reason), '') IS NOT NULL)
      OR (match_status <> 'excluded')
    ),
  CONSTRAINT accounting_bank_statement_lines_match_ok
    CHECK (
      (match_status = 'matched' AND matched_movement_id IS NOT NULL)
      OR (match_status <> 'matched' AND matched_movement_id IS NULL)
    )
);

COMMENT ON TABLE public.accounting_bank_statement_lines IS
  'Righe estratto conto/cassa. amount_cents: positivo=accredito, negativo=addebito.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_bank_statement_external
  ON public.accounting_bank_statement_lines (session_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_bank_statement_session
  ON public.accounting_bank_statement_lines (session_id);
CREATE INDEX IF NOT EXISTS idx_accounting_bank_statement_status
  ON public.accounting_bank_statement_lines (session_id, match_status);
CREATE INDEX IF NOT EXISTS idx_accounting_bank_statement_movement
  ON public.accounting_bank_statement_lines (matched_movement_id)
  WHERE matched_movement_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_accounting_bank_statement_updated_at
  ON public.accounting_bank_statement_lines;
CREATE TRIGGER trg_accounting_bank_statement_updated_at
  BEFORE UPDATE ON public.accounting_bank_statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_bank_statement_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_recon_sessions_select ON public.accounting_reconciliation_sessions;
CREATE POLICY accounting_recon_sessions_select ON public.accounting_reconciliation_sessions
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- Nessun INSERT/UPDATE/DELETE diretto: solo RPC SECURITY DEFINER
DROP POLICY IF EXISTS accounting_recon_sessions_write_deny ON public.accounting_reconciliation_sessions;

DROP POLICY IF EXISTS accounting_bank_statement_select ON public.accounting_bank_statement_lines;
CREATE POLICY accounting_bank_statement_select ON public.accounting_bank_statement_lines
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

REVOKE ALL ON TABLE public.accounting_reconciliation_sessions FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.accounting_bank_statement_lines FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.accounting_reconciliation_sessions TO authenticated, service_role;
GRANT SELECT ON TABLE public.accounting_bank_statement_lines TO authenticated, service_role;
GRANT ALL ON TABLE public.accounting_reconciliation_sessions TO service_role;
GRANT ALL ON TABLE public.accounting_bank_statement_lines TO service_role;

-- -----------------------------------------------------------------------------
-- 4) Helper: netto gestionale per conto/periodo (criterio cassa su settlement/movement)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_recon_managed_net_cents(
  p_account_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN m.direction = 'income' THEN m.amount_cents
      WHEN m.direction = 'expense' THEN -m.amount_cents
      WHEN m.direction = 'transfer' AND m.account_id = p_account_id THEN -m.amount_cents
      WHEN m.direction = 'transfer' AND m.transfer_account_id = p_account_id THEN m.amount_cents
      WHEN m.direction IN ('opening', 'adjustment') THEN m.amount_cents
      WHEN m.direction IN ('closing', 'reversal') THEN -m.amount_cents
      ELSE 0
    END
  ), 0)::bigint
  FROM public.accounting_movements m
  WHERE m.status = 'posted'
    AND (
      m.account_id = p_account_id
      OR m.transfer_account_id = p_account_id
    )
    AND COALESCE(m.settlement_date, m.movement_date) BETWEEN p_period_start AND p_period_end;
$$;

REVOKE ALL ON FUNCTION public.accounting_recon_managed_net_cents(uuid, date, date)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_recon_managed_net_cents(uuid, date, date)
  TO service_role;

-- -----------------------------------------------------------------------------
-- 5) RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_reconciliation_session_create(
  p_fiscal_year_id uuid,
  p_account_id uuid,
  p_period_start date,
  p_period_end date,
  p_opening_balance_cents bigint DEFAULT 0,
  p_closing_balance_statement_cents bigint DEFAULT 0,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_fy public.accounting_fiscal_years%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  IF p_fiscal_year_id IS NULL OR p_account_id IS NULL
    OR p_period_start IS NULL OR p_period_end IS NULL THEN
    RAISE EXCEPTION 'Esercizio, conto e periodo obbligatori';
  END IF;
  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'Il periodo non e'' valido';
  END IF;

  SELECT * INTO v_fy FROM public.accounting_fiscal_years WHERE id = p_fiscal_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esercizio non trovato';
  END IF;
  IF v_fy.status NOT IN ('open', 'closing') THEN
    RAISE EXCEPTION 'La riconciliazione e'' consentita solo su esercizi aperti o in chiusura';
  END IF;
  IF p_period_start < v_fy.starts_on OR p_period_end > v_fy.ends_on THEN
    RAISE EXCEPTION 'Il periodo deve rientrare nell''esercizio %', v_fy.code;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_accounts
    WHERE id = p_account_id AND is_active IS TRUE AND kind IN ('cash', 'bank')
  ) THEN
    RAISE EXCEPTION 'Seleziona un conto cassa o banca attivo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.accounting_reconciliation_sessions s
    WHERE s.account_id = p_account_id
      AND s.status IN ('draft', 'in_progress')
      AND s.period_start <= p_period_end
      AND s.period_end >= p_period_start
  ) THEN
    RAISE EXCEPTION 'Esiste gia'' una sessione aperta che si sovrappone a questo periodo';
  END IF;

  INSERT INTO public.accounting_reconciliation_sessions (
    fiscal_year_id, account_id, period_start, period_end,
    opening_balance_cents, closing_balance_statement_cents,
    status, notes, created_by, updated_by
  ) VALUES (
    p_fiscal_year_id, p_account_id, p_period_start, p_period_end,
    COALESCE(p_opening_balance_cents, 0),
    COALESCE(p_closing_balance_statement_cents, 0),
    'in_progress',
    NULLIF(btrim(p_notes), ''),
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  PERFORM public.accounting_audit_write(
    'accounting_reconciliation_sessions',
    v_id,
    'reconciliation_session_created',
    NULL,
    jsonb_build_object(
      'account_id', p_account_id,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'opening_balance_cents', COALESCE(p_opening_balance_cents, 0),
      'closing_balance_statement_cents', COALESCE(p_closing_balance_statement_cents, 0)
    ),
    NULL,
    'reconcile'
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_line_add(
  p_session_id uuid,
  p_line_date date,
  p_amount_cents bigint,
  p_description text DEFAULT '',
  p_reference text DEFAULT NULL,
  p_external_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessione non trovata';
  END IF;
  IF v_session.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'La sessione non e'' modificabile';
  END IF;
  IF p_line_date IS NULL OR p_amount_cents IS NULL OR p_amount_cents = 0 THEN
    RAISE EXCEPTION 'Data e importo (diverso da zero) obbligatori';
  END IF;
  IF p_line_date < v_session.period_start OR p_line_date > v_session.period_end THEN
    RAISE EXCEPTION 'La data della riga deve rientrare nel periodo della sessione';
  END IF;

  INSERT INTO public.accounting_bank_statement_lines (
    session_id, line_date, amount_cents, description, reference, external_id,
    match_status, created_by, updated_by
  ) VALUES (
    p_session_id,
    p_line_date,
    p_amount_cents,
    COALESCE(p_description, ''),
    NULLIF(btrim(p_reference), ''),
    NULLIF(btrim(p_external_id), ''),
    'unmatched',
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  IF v_session.status = 'draft' THEN
    UPDATE public.accounting_reconciliation_sessions
    SET status = 'in_progress', updated_by = auth.uid()
    WHERE id = p_session_id;
  END IF;

  PERFORM public.accounting_audit_write(
    'accounting_bank_statement_lines',
    v_id,
    'reconciliation_line_added',
    NULL,
    jsonb_build_object(
      'session_id', p_session_id,
      'line_date', p_line_date,
      'amount_cents', p_amount_cents
    ),
    NULL,
    'reconcile'
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_line_import_csv(
  p_session_id uuid,
  p_csv text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
  v_line text;
  v_parts text[];
  v_date date;
  v_amount numeric;
  v_amount_cents bigint;
  v_desc text;
  v_ref text;
  v_ext text;
  v_imported int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_row int := 0;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessione non trovata';
  END IF;
  IF v_session.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'La sessione non e'' modificabile';
  END IF;
  IF NULLIF(btrim(p_csv), '') IS NULL THEN
    RAISE EXCEPTION 'CSV vuoto';
  END IF;

  -- Formato TeamFlow: date;amount;description;reference[;external_id]
  -- date = YYYY-MM-DD, amount = euro con punto o virgola (es. 12.50 / -12,50)
  FOREACH v_line IN ARRAY string_to_array(replace(p_csv, E'\r\n', E'\n'), E'\n')
  LOOP
    v_row := v_row + 1;
    v_line := btrim(v_line);
    IF v_line = '' THEN
      CONTINUE;
    END IF;
    -- salta header
    IF lower(v_line) LIKE 'date;%' OR lower(v_line) LIKE 'data;%' THEN
      CONTINUE;
    END IF;

    v_parts := string_to_array(v_line, ';');
    IF array_length(v_parts, 1) < 2 THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_row, 'error', 'colonne insufficienti'));
      CONTINUE;
    END IF;

    BEGIN
      v_date := btrim(v_parts[1])::date;
      v_amount := replace(btrim(v_parts[2]), ',', '.')::numeric;
      v_amount_cents := round(v_amount * 100)::bigint;
      v_desc := COALESCE(v_parts[3], '');
      v_ref := CASE WHEN array_length(v_parts, 1) >= 4 THEN NULLIF(btrim(v_parts[4]), '') ELSE NULL END;
      v_ext := CASE WHEN array_length(v_parts, 1) >= 5 THEN NULLIF(btrim(v_parts[5]), '') ELSE NULL END;

      IF v_amount_cents = 0 THEN
        RAISE EXCEPTION 'importo zero';
      END IF;
      IF v_date < v_session.period_start OR v_date > v_session.period_end THEN
        RAISE EXCEPTION 'data fuori periodo';
      END IF;

      IF v_ext IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.accounting_bank_statement_lines
        WHERE session_id = p_session_id AND external_id = v_ext
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      INSERT INTO public.accounting_bank_statement_lines (
        session_id, line_date, amount_cents, description, reference, external_id,
        match_status, created_by, updated_by
      ) VALUES (
        p_session_id, v_date, v_amount_cents, v_desc, v_ref, v_ext,
        'unmatched', auth.uid(), auth.uid()
      )
      RETURNING id INTO v_id;

      v_imported := v_imported + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row', v_row, 'error', SQLERRM));
    END;
  END LOOP;

  IF v_session.status = 'draft' AND v_imported > 0 THEN
    UPDATE public.accounting_reconciliation_sessions
    SET status = 'in_progress', updated_by = auth.uid()
    WHERE id = p_session_id;
  END IF;

  PERFORM public.accounting_audit_write(
    'accounting_reconciliation_sessions',
    p_session_id,
    'reconciliation_csv_imported',
    NULL,
    jsonb_build_object('imported', v_imported, 'skipped', v_skipped),
    NULL,
    'reconcile'
  );

  RETURN jsonb_build_object(
    'imported', v_imported,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_line_match(
  p_line_id uuid,
  p_movement_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_line public.accounting_bank_statement_lines%ROWTYPE;
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
  v_mov public.accounting_movements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_line
  FROM public.accounting_bank_statement_lines
  WHERE id = p_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riga estratto non trovata';
  END IF;
  IF v_line.match_status <> 'unmatched' THEN
    RAISE EXCEPTION 'La riga non e'' abbinabile (stato %)', v_line.match_status;
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = v_line.session_id
  FOR UPDATE;
  IF v_session.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'Sessione non modificabile';
  END IF;

  SELECT * INTO v_mov
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_mov.status <> 'posted' THEN
    RAISE EXCEPTION 'Si possono abbinare solo movimenti contabilizzati';
  END IF;
  IF v_mov.account_id IS DISTINCT FROM v_session.account_id
    AND v_mov.transfer_account_id IS DISTINCT FROM v_session.account_id THEN
    RAISE EXCEPTION 'Il movimento non appartiene al conto della sessione';
  END IF;
  IF v_mov.fiscal_year_id IS DISTINCT FROM v_session.fiscal_year_id THEN
    RAISE EXCEPTION 'Il movimento non appartiene all''esercizio della sessione';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.accounting_bank_statement_lines
    WHERE matched_movement_id = p_movement_id
      AND match_status = 'matched'
  ) THEN
    RAISE EXCEPTION 'Il movimento e'' gia'' abbinato a un''altra riga';
  END IF;

  UPDATE public.accounting_bank_statement_lines
  SET
    match_status = 'matched',
    matched_movement_id = p_movement_id,
    exclude_reason = NULL,
    updated_by = auth.uid()
  WHERE id = p_line_id;

  PERFORM public.accounting_audit_write(
    'accounting_bank_statement_lines',
    p_line_id,
    'reconciliation_line_matched',
    jsonb_build_object('match_status', 'unmatched'),
    jsonb_build_object('match_status', 'matched', 'matched_movement_id', p_movement_id),
    NULL,
    'reconcile'
  );

  RETURN p_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_line_unmatch(
  p_line_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_line public.accounting_bank_statement_lines%ROWTYPE;
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_line
  FROM public.accounting_bank_statement_lines
  WHERE id = p_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riga estratto non trovata';
  END IF;
  IF v_line.match_status <> 'matched' THEN
    RAISE EXCEPTION 'La riga non e'' abbinata';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = v_line.session_id;
  IF v_session.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'Sessione non modificabile';
  END IF;

  UPDATE public.accounting_bank_statement_lines
  SET
    match_status = 'unmatched',
    matched_movement_id = NULL,
    updated_by = auth.uid()
  WHERE id = p_line_id;

  PERFORM public.accounting_audit_write(
    'accounting_bank_statement_lines',
    p_line_id,
    'reconciliation_line_unmatched',
    jsonb_build_object('match_status', 'matched', 'matched_movement_id', v_line.matched_movement_id),
    jsonb_build_object('match_status', 'unmatched'),
    NULL,
    'reconcile'
  );

  RETURN p_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_line_exclude(
  p_line_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_line public.accounting_bank_statement_lines%ROWTYPE;
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Motivazione obbligatoria per l''esclusione';
  END IF;

  SELECT * INTO v_line
  FROM public.accounting_bank_statement_lines
  WHERE id = p_line_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riga estratto non trovata';
  END IF;
  IF v_line.match_status = 'matched' THEN
    RAISE EXCEPTION 'Scollega prima il movimento abbinato';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = v_line.session_id;
  IF v_session.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'Sessione non modificabile';
  END IF;

  UPDATE public.accounting_bank_statement_lines
  SET
    match_status = 'excluded',
    matched_movement_id = NULL,
    exclude_reason = btrim(p_reason),
    updated_by = auth.uid()
  WHERE id = p_line_id;

  PERFORM public.accounting_audit_write(
    'accounting_bank_statement_lines',
    p_line_id,
    'reconciliation_line_excluded',
    jsonb_build_object('match_status', v_line.match_status),
    jsonb_build_object('match_status', 'excluded', 'exclude_reason', btrim(p_reason)),
    btrim(p_reason),
    'reconcile'
  );

  RETURN p_line_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_session_summary(
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
  v_managed bigint;
  v_statement_net bigint;
  v_matched int;
  v_unmatched int;
  v_excluded int;
  v_expected_closing bigint;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.view')
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.view o accounting.verify';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessione non trovata';
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN match_status = 'matched' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN match_status = 'unmatched' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN match_status = 'excluded' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN match_status <> 'excluded' THEN amount_cents ELSE 0 END), 0)
  INTO v_matched, v_unmatched, v_excluded, v_statement_net
  FROM public.accounting_bank_statement_lines
  WHERE session_id = p_session_id;

  v_managed := public.accounting_recon_managed_net_cents(
    v_session.account_id, v_session.period_start, v_session.period_end
  );
  v_expected_closing := v_session.opening_balance_cents + v_statement_net;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'status', v_session.status,
    'opening_balance_cents', v_session.opening_balance_cents,
    'closing_balance_statement_cents', v_session.closing_balance_statement_cents,
    'statement_net_cents', v_statement_net,
    'expected_closing_from_lines_cents', v_expected_closing,
    'managed_net_cents', v_managed,
    'managed_closing_cents', v_session.opening_balance_cents + v_managed,
    'difference_cents', v_session.closing_balance_statement_cents
      - (v_session.opening_balance_cents + v_managed),
    'lines_matched', v_matched,
    'lines_unmatched', v_unmatched,
    'lines_excluded', v_excluded,
    'note', 'Il saldo gestionale TeamFlow non e'' un saldo bancario riconciliato finche'' la sessione non e'' completata.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_session_complete(
  p_session_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
  v_unmatched int;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessione non trovata';
  END IF;
  IF v_session.status NOT IN ('draft', 'in_progress') THEN
    RAISE EXCEPTION 'La sessione non e'' completabile';
  END IF;

  SELECT count(*)::int INTO v_unmatched
  FROM public.accounting_bank_statement_lines
  WHERE session_id = p_session_id AND match_status = 'unmatched';

  IF v_unmatched > 0 THEN
    RAISE EXCEPTION 'Completa o escludi le % righe non abbinate prima di chiudere la sessione', v_unmatched;
  END IF;

  UPDATE public.accounting_reconciliation_sessions
  SET
    status = 'completed',
    completed_at = now(),
    completed_by = auth.uid(),
    updated_by = auth.uid()
  WHERE id = p_session_id;

  PERFORM public.accounting_audit_write(
    'accounting_reconciliation_sessions',
    p_session_id,
    'reconciliation_session_completed',
    jsonb_build_object('status', v_session.status),
    jsonb_build_object('status', 'completed'),
    NULL,
    'reconcile',
    NULL,
    public.accounting_reconciliation_session_summary(p_session_id)
  );

  RETURN p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_reconciliation_session_cancel(
  p_session_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.accounting_reconciliation_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_session
  FROM public.accounting_reconciliation_sessions
  WHERE id = p_session_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessione non trovata';
  END IF;
  IF v_session.status = 'completed' THEN
    RAISE EXCEPTION 'Una sessione completata non puo'' essere annullata';
  END IF;
  IF v_session.status = 'cancelled' THEN
    RETURN p_session_id;
  END IF;

  UPDATE public.accounting_reconciliation_sessions
  SET
    status = 'cancelled',
    notes = CASE
      WHEN NULLIF(btrim(p_reason), '') IS NULL THEN notes
      WHEN NULLIF(btrim(notes), '') IS NULL THEN 'Annullata: ' || btrim(p_reason)
      ELSE notes || E'\nAnnullata: ' || btrim(p_reason)
    END,
    updated_by = auth.uid()
  WHERE id = p_session_id;

  PERFORM public.accounting_audit_write(
    'accounting_reconciliation_sessions',
    p_session_id,
    'reconciliation_session_cancelled',
    jsonb_build_object('status', v_session.status),
    jsonb_build_object('status', 'cancelled'),
    NULLIF(btrim(p_reason), ''),
    'reconcile'
  );

  RETURN p_session_id;
END;
$$;

-- Grants RPC pubbliche
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT unnest(ARRAY[
      'accounting_reconciliation_session_create(uuid,uuid,date,date,bigint,bigint,text)',
      'accounting_reconciliation_line_add(uuid,date,bigint,text,text,text)',
      'accounting_reconciliation_line_import_csv(uuid,text)',
      'accounting_reconciliation_line_match(uuid,uuid)',
      'accounting_reconciliation_line_unmatch(uuid)',
      'accounting_reconciliation_line_exclude(uuid,text)',
      'accounting_reconciliation_session_summary(uuid)',
      'accounting_reconciliation_session_complete(uuid)',
      'accounting_reconciliation_session_cancel(uuid,text)'
    ]) AS sig
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r.sig);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
