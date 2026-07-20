-- =============================================================================
-- 020_accounting_sponsorship_docs.sql
-- =============================================================================
-- Contratti di sponsorizzazione + bozza testo / PDF su documenti commerciali.
-- Gate: emissione sponsorship richiede contratto confirmed stessa controparte + FY.
--
-- NON APPLICARE senza approvazione.
-- Dipende da: 012 (counterparties), 018 (commercial documents).
-- NON modifica Quote / FlowMe / 010–019.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) accounting_sponsorship_contracts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_sponsorship_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  counterparty_id uuid NOT NULL
    REFERENCES public.accounting_counterparties(id) ON DELETE RESTRICT,
  title text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NULL,
  taxable_amount_cents bigint NOT NULL DEFAULT 0
    CHECK (taxable_amount_cents >= 0),
  vat_rate_basis_points integer NOT NULL DEFAULT 2200
    CHECK (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 10000),
  gross_amount_cents bigint NOT NULL DEFAULT 0
    CHECK (gross_amount_cents >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  body_text text NOT NULL DEFAULT '',
  pdf_path text NULL,
  notes text NULL,
  confirmed_at timestamptz NULL,
  confirmed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz NULL,
  cancelled_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_sponsorship_contracts_title_nonempty
    CHECK (btrim(title) <> ''),
  CONSTRAINT accounting_sponsorship_contracts_dates
    CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT accounting_sponsorship_contracts_confirmed_fields
    CHECK (
      (status = 'draft' AND confirmed_at IS NULL AND confirmed_by IS NULL)
      OR (status = 'confirmed' AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)
      OR (status = 'cancelled')
    )
);

COMMENT ON TABLE public.accounting_sponsorship_contracts IS
  'Contratti sponsor (bozza editabile in app; PDF solo dopo conferma). '
  'Gate per emissione documenti commerciali kind=sponsorship.';

CREATE INDEX IF NOT EXISTS idx_accounting_sponsorship_contracts_fy
  ON public.accounting_sponsorship_contracts (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_accounting_sponsorship_contracts_cp
  ON public.accounting_sponsorship_contracts (counterparty_id);
CREATE INDEX IF NOT EXISTS idx_accounting_sponsorship_contracts_status
  ON public.accounting_sponsorship_contracts (status);

DROP TRIGGER IF EXISTS trg_accounting_sponsorship_contracts_updated_at
  ON public.accounting_sponsorship_contracts;
CREATE TRIGGER trg_accounting_sponsorship_contracts_updated_at
  BEFORE UPDATE ON public.accounting_sponsorship_contracts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

DROP TRIGGER IF EXISTS trg_accounting_sponsorship_contracts_forbid_delete
  ON public.accounting_sponsorship_contracts;
CREATE TRIGGER trg_accounting_sponsorship_contracts_forbid_delete
  BEFORE DELETE ON public.accounting_sponsorship_contracts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_forbid_physical_delete();

-- -----------------------------------------------------------------------------
-- 2) Colonne documenti commerciali (bozza testo, PDF, link contratto)
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_commercial_documents
  ADD COLUMN IF NOT EXISTS draft_body_text text NULL;

ALTER TABLE public.accounting_commercial_documents
  ADD COLUMN IF NOT EXISTS pdf_path text NULL;

ALTER TABLE public.accounting_commercial_documents
  ADD COLUMN IF NOT EXISTS sponsorship_contract_id uuid NULL
    REFERENCES public.accounting_sponsorship_contracts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.accounting_commercial_documents.draft_body_text IS
  'Bozza testo fattura/documento editabile in app (fonte di verità pre-PDF).';
COMMENT ON COLUMN public.accounting_commercial_documents.pdf_path IS
  'Path Storage PDF dopo emissione/conferma (bucket accounting-docs).';
COMMENT ON COLUMN public.accounting_commercial_documents.sponsorship_contract_id IS
  'Contratto sponsor collegato (obbligatorio confirmed per kind=sponsorship in issue).';

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_docs_contract
  ON public.accounting_commercial_documents (sponsorship_contract_id);

-- -----------------------------------------------------------------------------
-- 3) Immutabilità contratti
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_sponsorship_contracts_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_allow text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contracts: DELETE fisico vietato'
      USING ERRCODE = 'check_violation';
  END IF;

  v_allow := current_setting('accounting.allow_commercial_mutation', true);

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contracts: contratto cancelled immutabile'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'confirmed'
     AND v_allow IS DISTINCT FROM '1' THEN
    -- Permetti solo aggiornamento pdf_path (post-upload client) se già confirmed
    -- senza GUC: bloccato. Con GUC (RPC) ok.
    RAISE EXCEPTION
      'accounting_sponsorship_contracts: confirmed mutabile solo via RPC (GUC allow_commercial_mutation)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_sponsorship_contracts_immutability
  ON public.accounting_sponsorship_contracts;
CREATE TRIGGER trg_accounting_sponsorship_contracts_immutability
  BEFORE UPDATE OR DELETE ON public.accounting_sponsorship_contracts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_sponsorship_contracts_immutability();

REVOKE ALL ON FUNCTION public.accounting_sponsorship_contracts_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_sponsorship_contracts_immutability() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_sponsorship_contracts_immutability() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_sponsorship_contracts_immutability() TO service_role;

-- -----------------------------------------------------------------------------
-- 4) RPC: conferma contratto
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_sponsorship_contract_confirm(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_sponsorship_contracts%ROWTYPE;
  v_new public.accounting_sponsorship_contracts%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'accounting_sponsorship_contract_confirm: p_id obbligatorio';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.create')
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_confirm: permesso insufficiente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_confirm: auth.uid() richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_sponsorship_contracts
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_sponsorship_contract_confirm: contratto % non trovato', p_id;
  END IF;

  IF v_old.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_confirm: status deve essere draft (attuale: %)'
      , v_old.status;
  END IF;

  IF btrim(COALESCE(v_old.body_text, '')) = '' THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_confirm: body_text obbligatorio';
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_sponsorship_contracts
  SET status = 'confirmed',
      confirmed_at = now(),
      confirmed_by = v_uid,
      updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_sponsorship_contracts',
    p_id,
    'sponsorship_contract_confirmed',
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULL,
    'ui',
    NULL,
    NULL
  );

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_sponsorship_contract_confirm(uuid) IS
  'draft → confirmed. PDF generato lato client dopo conferma e allegato via set_pdf_path.';

-- -----------------------------------------------------------------------------
-- 5) RPC: set pdf_path (contratto / documento)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_sponsorship_contract_set_pdf_path(
  p_id uuid,
  p_pdf_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_sponsorship_contracts%ROWTYPE;
BEGIN
  IF p_id IS NULL OR NULLIF(btrim(COALESCE(p_pdf_path, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_set_pdf_path: id e pdf_path obbligatori';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.create')
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_set_pdf_path: permesso insufficiente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_sponsorship_contracts
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_set_pdf_path: contratto % non trovato', p_id;
  END IF;

  IF v_old.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_set_pdf_path: contratto deve essere confirmed';
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_sponsorship_contracts
  SET pdf_path = btrim(p_pdf_path),
      updated_by = v_uid
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_set_pdf_path(
  p_id uuid,
  p_pdf_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_commercial_documents%ROWTYPE;
BEGIN
  IF p_id IS NULL OR NULLIF(btrim(COALESCE(p_pdf_path, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_set_pdf_path: id e pdf_path obbligatori';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.create')
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_set_pdf_path: permesso insufficiente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_commercial_documents
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_set_pdf_path: documento % non trovato', p_id;
  END IF;

  IF v_old.status NOT IN ('issued', 'partially_collected', 'collected') THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_set_pdf_path: documento deve essere emesso (status=%)'
      , v_old.status;
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_commercial_documents
  SET pdf_path = btrim(p_pdf_path),
      updated_by = v_uid
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6) Patch issue: gate contratto sponsor
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_issue(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_commercial_documents%ROWTYPE;
  v_new public.accounting_commercial_documents%ROWTYPE;
  v_num text;
  v_round_param record;
  v_rate_param record;
  v_method text;
  v_proposed_pct numeric;
  v_proposed_bp integer;
  v_expected_vat bigint;
  v_can_override_rate boolean;
  v_contract public.accounting_sponsorship_contracts%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'accounting_commercial_doc_issue: p_id obbligatorio';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.create')
    OR public.has_accounting_permission('accounting.edit_draft')
  ) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: permesso create/edit_draft o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_commercial_documents
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_commercial_doc_issue: documento % non trovato', p_id;
  END IF;

  IF v_old.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: status deve essere draft (attuale: %)'
      , v_old.status;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: utente autenticato richiesto (auth.uid())'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- GATE sponsorizzazione: contratto confirmed stessa controparte + FY
  IF v_old.commercial_kind = 'sponsorship' THEN
    IF v_old.sponsorship_contract_id IS NULL THEN
      -- Accetta qualsiasi contratto confirmed per CP+FY
      IF NOT EXISTS (
        SELECT 1
        FROM public.accounting_sponsorship_contracts c
        WHERE c.fiscal_year_id = v_old.fiscal_year_id
          AND c.counterparty_id = v_old.counterparty_id
          AND c.status = 'confirmed'
      ) THEN
        RAISE EXCEPTION
          'accounting_commercial_doc_issue: per sponsorship serve un contratto di sponsorizzazione confermato con la stessa controparte nell''esercizio; crea e conferma il contratto prima di emettere'
          USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      SELECT * INTO v_contract
      FROM public.accounting_sponsorship_contracts
      WHERE id = v_old.sponsorship_contract_id;

      IF NOT FOUND
         OR v_contract.status IS DISTINCT FROM 'confirmed'
         OR v_contract.counterparty_id IS DISTINCT FROM v_old.counterparty_id
         OR v_contract.fiscal_year_id IS DISTINCT FROM v_old.fiscal_year_id
      THEN
        RAISE EXCEPTION
          'accounting_commercial_doc_issue: sponsorship_contract_id non valido o non confirmed per controparte/esercizio; documento resta draft'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  v_num := NULLIF(btrim(COALESCE(v_old.document_number, '')), '');

  IF v_old.document_type = 'invoice' AND v_num IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: document_number obbligatorio e non vuoto per document_type=invoice (documento resta draft)';
  END IF;

  IF v_num IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.accounting_commercial_documents d
    WHERE d.id IS DISTINCT FROM p_id
      AND d.fiscal_year_id = v_old.fiscal_year_id
      AND d.document_type = v_old.document_type
      AND btrim(COALESCE(d.document_number, '')) = v_num
      AND d.status IS DISTINCT FROM 'cancelled'
  ) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: numero documento duplicato per esercizio/tipo "%" (esclusi cancelled); documento resta draft'
      , v_num;
  END IF;

  SELECT * INTO v_round_param
  FROM public.accounting_fiscal_param_resolve('vat_rounding_method', v_old.document_date);

  IF v_round_param.id IS NULL OR v_round_param.value_json IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: parametro vat_rounding_method assente alla data documento; emissione bloccata (resta draft)';
  END IF;

  v_method := public.accounting_fiscal_param_text(v_round_param.value_json);
  IF v_method IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: vat_rounding_method non valido; emissione bloccata (resta draft)';
  END IF;

  BEGIN
    v_expected_vat := public.accounting_vat_from_taxable(
      v_old.taxable_amount_cents,
      v_old.vat_rate_basis_points,
      v_method
    );
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: calcolo IVA non riuscito (%); documento resta draft'
      , SQLERRM;
  END;

  IF v_old.vat_amount_cents IS DISTINCT FROM v_expected_vat THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: vat_amount_cents (%) != expected (%) con metodo %; documento resta draft'
      , v_old.vat_amount_cents, v_expected_vat, v_method;
  END IF;

  IF v_old.gross_amount_cents IS DISTINCT FROM
     (v_old.taxable_amount_cents + v_old.vat_amount_cents) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: gross_amount_cents (%) != taxable+vat (%); documento resta draft'
      , v_old.gross_amount_cents,
        (v_old.taxable_amount_cents + v_old.vat_amount_cents);
  END IF;

  SELECT * INTO v_rate_param
  FROM public.accounting_fiscal_param_resolve('vat_rate_sponsorship', v_old.document_date);

  IF v_rate_param.id IS NULL OR v_rate_param.value_json IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: parametro vat_rate_sponsorship assente alla data documento; emissione bloccata (resta draft)';
  END IF;

  v_proposed_pct := public.accounting_fiscal_param_numeric(v_rate_param.value_json);
  IF v_proposed_pct IS NULL OR v_proposed_pct < 0 THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: vat_rate_sponsorship non numerico; emissione bloccata (resta draft)';
  END IF;

  v_proposed_bp := round(v_proposed_pct * 100)::integer;
  v_can_override_rate :=
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings');

  IF v_old.vat_rate_basis_points IS DISTINCT FROM v_proposed_bp
     AND NOT v_can_override_rate THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: override aliquota (%) rispetto a proposta (%) richiede accounting.manage_settings o Admin; documento resta draft'
      , v_old.vat_rate_basis_points, v_proposed_bp
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_commercial_documents
  SET status = 'issued',
      document_number = v_num,
      issued_at = now(),
      issued_by = v_uid,
      updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_commercial_documents',
    p_id,
    'commercial_doc_issued',
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULL,
    'ui',
    NULL,
    jsonb_build_object(
      'from_status', v_old.status,
      'to_status', 'issued',
      'rounding_method', v_method,
      'proposed_rate_bp', v_proposed_bp,
      'rate_override', v_old.vat_rate_basis_points IS DISTINCT FROM v_proposed_bp,
      'sponsorship_contract_gate', v_old.commercial_kind = 'sponsorship'
    )
  );

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_issue(uuid) IS
  'draft → issued. Per sponsorship richiede contratto confirmed (stessa controparte+FY). '
  'Invoice number, IVA coherency, rate override come in 018.';

-- -----------------------------------------------------------------------------
-- 7) GRANT + RLS
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounting_sponsorship_contracts FROM anon;
REVOKE ALL ON TABLE public.accounting_sponsorship_contracts FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_sponsorship_contracts FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_sponsorship_contracts TO authenticated;
GRANT ALL ON TABLE public.accounting_sponsorship_contracts TO service_role;

ALTER TABLE public.accounting_sponsorship_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_sponsorship_contracts_select
  ON public.accounting_sponsorship_contracts;
CREATE POLICY accounting_sponsorship_contracts_select
  ON public.accounting_sponsorship_contracts
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_sponsorship_contracts_insert
  ON public.accounting_sponsorship_contracts;
CREATE POLICY accounting_sponsorship_contracts_insert
  ON public.accounting_sponsorship_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
    )
    AND status = 'draft'
  );

DROP POLICY IF EXISTS accounting_sponsorship_contracts_update_draft
  ON public.accounting_sponsorship_contracts;
CREATE POLICY accounting_sponsorship_contracts_update_draft
  ON public.accounting_sponsorship_contracts
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
      OR public.has_accounting_permission('accounting.create')
    )
    AND status = 'draft'
  )
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
      OR public.has_accounting_permission('accounting.create')
    )
    AND status = 'draft'
  );

-- Mutazioni confirmed/cancelled solo via RPC SECURITY DEFINER

REVOKE ALL ON FUNCTION public.accounting_sponsorship_contract_confirm(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_sponsorship_contract_confirm(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_sponsorship_contract_confirm(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_sponsorship_contract_confirm(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.accounting_sponsorship_contract_set_pdf_path(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_sponsorship_contract_set_pdf_path(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_sponsorship_contract_set_pdf_path(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_sponsorship_contract_set_pdf_path(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.accounting_commercial_doc_set_pdf_path(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_commercial_doc_set_pdf_path(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_doc_set_pdf_path(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_doc_set_pdf_path(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.accounting_commercial_doc_issue(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_commercial_doc_issue(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_doc_issue(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_doc_issue(uuid) TO service_role;

COMMIT;
