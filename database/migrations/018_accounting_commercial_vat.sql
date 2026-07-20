-- =============================================================================
-- 018_accounting_commercial_vat.sql
-- =============================================================================
-- STEP 5A — Documenti commerciali, pagamenti multipli, periodi IVA
-- REVISIONE FINALE BLOCCANTE: invoice number, IVA coherency, bp<=10000,
-- cancel rules, GRANT split RPC/helpers, payment FY/account checks.
--
-- NON APPLICARE senza approvazione.
--
-- Does NOT modify Quote / FlowMe / migrations 010–017.
-- Independent of 019 category settings (seed SPONSOR ok).
--
-- Fiscal param keys EXACTLY as in 010 (no invented keys):
--   commercial_revenue_limit
--   vat_flat_deduction_pct
--   vat_periodicity
--   vat_rate_sponsorship
--   vat_rounding_method
--
-- Momento impositivo (ipotesi gestionale): default = document_date
-- per attribuzione al trimestre IVA. Il commercialista deve confermare
-- se per il regime 398/1991 dell'ASD prevale data documento o data incasso.
--
-- Crea:
--   - accounting_commercial_documents (+ status partially_collected)
--   - accounting_commercial_document_payments (allocazioni multi-movimento)
--   - accounting_vat_periods
--   - helper pagamento / refresh status / parametri IVA
--   - RPC issue / cancel / register_payment / link_movement
--   - RPC vat calculate / verify / mark_paid
--   - trigger immutabilità + validazione pagamenti
--   - RLS + GRANT minimo
--
-- Strumento gestionale interno ASD: NON è SDI, F24 né dichiarazione fiscale.
-- =============================================================================
--
-- Formula demo (commento puro):
--   imponibile 1_000_000 cent × 2200 bp (22%) → IVA 220_000
--   forfait 50% → 110_000; IVA stimata dovuta → 110_000
--
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Categoria SPONSOR (seed idempotente)
--    Inserisce SPONSOR solo se non esiste né SPONSOR né SPONSORIZZAZIONI.
-- -----------------------------------------------------------------------------
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, sort_order, notes
)
SELECT
  'SPONSOR',
  'Sponsorizzazioni e proventi commerciali',
  'income',
  'commercial',
  true,
  true,
  15,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. '
  'Categoria di sistema per documenti commerciali / incassi sponsor. '
  'Inclusione nel limite 398 e natura commerciale sono ipotesi iniziali.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'SPONSOR'
)
AND NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'SPONSORIZZAZIONI'
);

-- -----------------------------------------------------------------------------
-- 2) accounting_commercial_documents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_commercial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  counterparty_id uuid NOT NULL
    REFERENCES public.accounting_counterparties(id) ON DELETE RESTRICT,
  document_type text NOT NULL
    CHECK (document_type IN ('invoice', 'receipt', 'fiscal_receipt', 'other')),
  document_number text NULL,
  document_date date NOT NULL,
  description text NOT NULL,
  commercial_kind text NOT NULL
    CHECK (commercial_kind IN (
      'sponsorship',
      'advertising',
      'ticketing',
      'merchandising',
      'services',
      'other'
    )),
  taxable_amount_cents bigint NOT NULL
    CHECK (taxable_amount_cents >= 0),
  vat_rate_basis_points integer NOT NULL
    CHECK (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 10000),
  vat_amount_cents bigint NOT NULL
    CHECK (vat_amount_cents >= 0),
  gross_amount_cents bigint NOT NULL
    CHECK (gross_amount_cents >= 0),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'issued',
      'partially_collected',
      'collected',
      'cancelled'
    )),
  -- LEGACY: non usato dalle nuove RPC; preferire accounting_commercial_document_payments
  movement_id uuid NULL
    REFERENCES public.accounting_movements(id) ON DELETE SET NULL,
  include_in_398_limit boolean NOT NULL DEFAULT true,
  notes text NULL,
  issued_at timestamptz NULL,
  issued_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  collected_at timestamptz NULL,
  collected_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz NULL,
  cancelled_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_commercial_documents_description_nonempty
    CHECK (btrim(description) <> ''),
  CONSTRAINT accounting_commercial_documents_gross_equals_parts
    CHECK (gross_amount_cents = taxable_amount_cents + vat_amount_cents)
);

COMMENT ON TABLE public.accounting_commercial_documents IS
  'Documenti commerciali gestionali (sponsor, pubblicità, biglietteria, …). '
  'Strumento interno TeamFlow: NON è fatturazione elettronica SDI né F24. '
  'Incassi multipli via accounting_commercial_document_payments. '
  'Importi, aliquote e inclusione limite 398 da verificare con il commercialista.';

COMMENT ON COLUMN public.accounting_commercial_documents.vat_rate_basis_points IS
  'Aliquota IVA in basis points: 2200 = 22,00%. Max 10000 = 100,00%.';

COMMENT ON COLUMN public.accounting_commercial_documents.status IS
  'draft = modificabile client; issued/partially_collected/collected = mutabili '
  'solo via RPC + GUC; cancelled = immutabile (soft cancel). DELETE fisico vietato.';

COMMENT ON COLUMN public.accounting_commercial_documents.include_in_398_limit IS
  'Se true, il documento concorre al monitoraggio limite commerciale 398 (gestionale).';

COMMENT ON COLUMN public.accounting_commercial_documents.movement_id IS
  'deprecated; use accounting_commercial_document_payments. '
  'Colonna LEGACY nullable; le RPC register_payment / link_movement NON la impostano.';

COMMENT ON COLUMN public.accounting_commercial_documents.document_date IS
  'Momento impositivo gestionale di default per attribuzione trimestre IVA. '
  'Ipotesi interna: confermare col commercialista (documento vs incasso).';

-- Se tabella già creata da bozza 018 precedente: allinea CHECK status/bp + drop unique movement
DO $$
DECLARE
  r record;
BEGIN
  -- Drop unique index LEGACY su movement_id (preferiamo colonna nullable inutilizzata)
  DROP INDEX IF EXISTS public.uq_accounting_commercial_documents_movement;

  -- Allinea CHECK status (include partially_collected)
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%partially_collected%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.accounting_commercial_documents DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%partially_collected%'
  ) THEN
    ALTER TABLE public.accounting_commercial_documents
      ADD CONSTRAINT accounting_commercial_documents_status_check
      CHECK (status IN (
        'draft',
        'issued',
        'partially_collected',
        'collected',
        'cancelled'
      ));
  END IF;

  -- Corregge CHECK vat_rate_basis_points: max 10000 (100,00%), non 100000
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
      AND (
        pg_get_constraintdef(c.oid) ILIKE '%100000%'
        OR pg_get_constraintdef(c.oid) NOT ILIKE '%10000%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.accounting_commercial_documents DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
      AND pg_get_constraintdef(c.oid) ILIKE '%10000%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%100000%'
  ) THEN
    ALTER TABLE public.accounting_commercial_documents
      ADD CONSTRAINT accounting_commercial_documents_vat_rate_basis_points_check
      CHECK (vat_rate_basis_points >= 0 AND vat_rate_basis_points <= 10000);
  END IF;
END;
$$;

-- Unicità numero documento (esclude cancelled). Regola documentata:
-- stesso fiscal_year_id + document_type + btrim(document_number) → al più uno
-- non-cancelled. I cancelled non bloccano il riuso del numero.
DROP INDEX IF EXISTS public.uq_accounting_commercial_documents_number_active;
CREATE UNIQUE INDEX uq_accounting_commercial_documents_number_active
  ON public.accounting_commercial_documents (
    fiscal_year_id,
    document_type,
    (btrim(document_number))
  )
  WHERE status IS DISTINCT FROM 'cancelled'
    AND document_number IS NOT NULL
    AND btrim(document_number) <> '';

COMMENT ON INDEX public.uq_accounting_commercial_documents_number_active IS
  'Unicità numero documento attiva: FY + type + btrim(number), status <> cancelled.';

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_documents_fiscal_year
  ON public.accounting_commercial_documents (fiscal_year_id);

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_documents_document_date
  ON public.accounting_commercial_documents (document_date);

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_documents_status
  ON public.accounting_commercial_documents (status);

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_documents_commercial_kind
  ON public.accounting_commercial_documents (commercial_kind);

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_documents_counterparty
  ON public.accounting_commercial_documents (counterparty_id);

DROP TRIGGER IF EXISTS trg_accounting_commercial_documents_updated_at
  ON public.accounting_commercial_documents;
CREATE TRIGGER trg_accounting_commercial_documents_updated_at
  BEFORE UPDATE ON public.accounting_commercial_documents
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) accounting_commercial_document_payments (allocazioni multi-movimento)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_commercial_document_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL
    REFERENCES public.accounting_commercial_documents(id) ON DELETE RESTRICT,
  movement_id uuid NOT NULL
    REFERENCES public.accounting_movements(id) ON DELETE RESTRICT,
  allocated_amount_cents bigint NOT NULL
    CHECK (allocated_amount_cents > 0),
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_commercial_document_payments_doc_mov_unique
    UNIQUE (document_id, movement_id)
);

COMMENT ON TABLE public.accounting_commercial_document_payments IS
  'Allocazioni pagamento documento commerciale ↔ movimento income. '
  'Un documento può avere più pagamenti (parziali); un movimento può essere '
  'allocato a più documenti (UNIQUE per coppia). '
  'Solo movimenti posted+income contano come incassati (helper is_effective). '
  'Mutazioni solo via RPC SECURITY DEFINER.';

COMMENT ON COLUMN public.accounting_commercial_document_payments.allocated_amount_cents IS
  'Importo allocato in centesimi (> 0). Somma per documento ≤ gross; '
  'somma per movimento ≤ amount_cents del movimento.';

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_document_payments_document
  ON public.accounting_commercial_document_payments (document_id);

CREATE INDEX IF NOT EXISTS idx_accounting_commercial_document_payments_movement
  ON public.accounting_commercial_document_payments (movement_id);

-- -----------------------------------------------------------------------------
-- 4) accounting_vat_periods
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_vat_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  year integer NOT NULL,
  quarter integer NOT NULL
    CHECK (quarter >= 1 AND quarter <= 4),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'calculated', 'verified', 'paid')),
  commercial_taxable_cents bigint NOT NULL DEFAULT 0
    CHECK (commercial_taxable_cents >= 0),
  output_vat_cents bigint NOT NULL DEFAULT 0
    CHECK (output_vat_cents >= 0),
  forfait_deduction_cents bigint NOT NULL DEFAULT 0
    CHECK (forfait_deduction_cents >= 0),
  estimated_vat_due_cents bigint NOT NULL DEFAULT 0
    CHECK (estimated_vat_due_cents >= 0),
  indicative_due_on date NULL,
  verified_at timestamptz NULL,
  verified_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  paid_at timestamptz NULL,
  payment_reference text NULL,
  param_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_vat_periods_fy_year_quarter_unique
    UNIQUE (fiscal_year_id, year, quarter)
);

COMMENT ON TABLE public.accounting_vat_periods IS
  'Periodi IVA trimestrali gestionali (stima regime forfettario 398). '
  'Attribuzione documenti per document_date (momento impositivo ipotesi gestionale). '
  'NON sostituisce F24 / dichiarazioni. Scadenze indicative_due_on solo indicative.';

COMMENT ON COLUMN public.accounting_vat_periods.indicative_due_on IS
  'Scadenza INDICATIVA (non normativa): Q1→16/05, Q2→20/08, Q3→16/11, Q4→16/02 anno+1. '
  'Da verificare sempre con il commercialista.';

COMMENT ON COLUMN public.accounting_vat_periods.param_snapshot IS
  'Snapshot parametri fiscali usati nel calcolo (chiavi esatte 010 + verification_status). '
  'verify richiede che tutti siano verification_status = verified.';

COMMENT ON COLUMN public.accounting_vat_periods.status IS
  'open = vuoto/iniziale; calculated = ricalcolabile; verified/paid = immutabili '
  'senza GUC accounting.allow_commercial_mutation=1 (solo RPC controllate).';

CREATE INDEX IF NOT EXISTS idx_accounting_vat_periods_fiscal_year
  ON public.accounting_vat_periods (fiscal_year_id);

CREATE INDEX IF NOT EXISTS idx_accounting_vat_periods_status
  ON public.accounting_vat_periods (status);

CREATE INDEX IF NOT EXISTS idx_accounting_vat_periods_year_quarter
  ON public.accounting_vat_periods (year, quarter);

DROP TRIGGER IF EXISTS trg_accounting_vat_periods_updated_at
  ON public.accounting_vat_periods;
CREATE TRIGGER trg_accounting_vat_periods_updated_at
  BEFORE UPDATE ON public.accounting_vat_periods
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 5) Helper: pagamento efficace / raccolto / allocato / refresh status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_commercial_payment_is_effective(
  p_movement_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounting_movements m
    WHERE m.id = p_movement_id
      AND m.status = 'posted'
      AND m.direction = 'income'
  );
$$;

COMMENT ON FUNCTION public.accounting_commercial_payment_is_effective(uuid) IS
  'True se il movimento esiste, status=posted e direction=income. '
  'reversed / cancelled / draft NON contano verso collected.';

CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_collected_cents(
  p_document_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(p.allocated_amount_cents), 0)::bigint
  FROM public.accounting_commercial_document_payments p
  WHERE p.document_id = p_document_id
    AND public.accounting_commercial_payment_is_effective(p.movement_id);
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_collected_cents(uuid) IS
  'Somma allocated_amount_cents dei pagamenti del documento con movimento efficace '
  '(posted + income).';

CREATE OR REPLACE FUNCTION public.accounting_commercial_movement_allocated_cents(
  p_movement_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  -- Conta TUTTE le allocazioni del movimento (anche se non ancora efficaci)
  -- per impedire over-allocate prima di un reverse.
  SELECT COALESCE(SUM(p.allocated_amount_cents), 0)::bigint
  FROM public.accounting_commercial_document_payments p
  WHERE p.movement_id = p_movement_id;
$$;

COMMENT ON FUNCTION public.accounting_commercial_movement_allocated_cents(uuid) IS
  'Somma di tutte le allocazioni sul movimento (anti over-allocate). '
  'Quando il movimento viene reversed/cancelled, collected scende via is_effective.';

CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_refresh_collection_status(
  p_document_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_doc public.accounting_commercial_documents%ROWTYPE;
  v_collected bigint;
  v_residual bigint;
  v_uid uuid := auth.uid();
  v_new_status text;
BEGIN
  IF p_document_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_doc
  FROM public.accounting_commercial_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Mai toccare draft / cancelled
  IF v_doc.status NOT IN ('issued', 'partially_collected', 'collected') THEN
    RETURN;
  END IF;

  v_collected := public.accounting_commercial_doc_collected_cents(p_document_id);
  v_residual := v_doc.gross_amount_cents - v_collected;

  IF v_residual <= 0 THEN
    v_new_status := 'collected';
  ELSIF v_collected > 0 THEN
    v_new_status := 'partially_collected';
  ELSE
    v_new_status := 'issued';
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  IF v_new_status = 'collected' THEN
    UPDATE public.accounting_commercial_documents
    SET status = 'collected',
        collected_at = CASE
          WHEN v_doc.status IS DISTINCT FROM 'collected' OR v_doc.collected_at IS NULL
            THEN now()
          ELSE v_doc.collected_at
        END,
        collected_by = CASE
          WHEN v_doc.status IS DISTINCT FROM 'collected' OR v_doc.collected_by IS NULL
            THEN v_uid
          ELSE v_doc.collected_by
        END,
        updated_by = COALESCE(v_uid, updated_by)
    WHERE id = p_document_id;
  ELSIF v_new_status = 'partially_collected' THEN
    UPDATE public.accounting_commercial_documents
    SET status = 'partially_collected',
        collected_at = NULL,
        collected_by = NULL,
        updated_by = COALESCE(v_uid, updated_by)
    WHERE id = p_document_id;
  ELSE
    -- issued: residual pieno, nessun incasso efficace
    UPDATE public.accounting_commercial_documents
    SET status = 'issued',
        collected_at = NULL,
        collected_by = NULL,
        updated_by = COALESCE(v_uid, updated_by)
    WHERE id = p_document_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_refresh_collection_status(uuid) IS
  'Aggiorna status issued|partially_collected|collected in base a residual = gross - collected. '
  'Non tocca draft/cancelled. Imposta collected_at/by solo al passaggio a collected pieno.';

-- -----------------------------------------------------------------------------
-- 6) Trigger immutabilità documenti / vat_periods
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_commercial_documents_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_allow text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'accounting_commercial_documents: DELETE fisico vietato; usare soft cancel (RPC cancel)'
      USING ERRCODE = 'check_violation';
  END IF;

  v_allow := current_setting('accounting.allow_commercial_mutation', true);

  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION
      'accounting_commercial_documents: documento cancelled immutabile'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status IN ('issued', 'partially_collected', 'collected')
     AND v_allow IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION
      'accounting_commercial_documents: status % mutabile solo via RPC (GUC allow_commercial_mutation)'
      , OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_documents_immutability() IS
  'BEFORE UPDATE/DELETE: cancelled sempre immutabile; '
  'issued/partially_collected/collected richiedono '
  'set_config(''accounting.allow_commercial_mutation'',''1'',true). '
  'DELETE fisico sempre vietato.';

REVOKE ALL ON FUNCTION public.accounting_commercial_documents_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_commercial_documents_immutability() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_commercial_documents_immutability() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_documents_immutability() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_commercial_documents_immutability
  ON public.accounting_commercial_documents;
CREATE TRIGGER trg_accounting_commercial_documents_immutability
  BEFORE UPDATE OR DELETE ON public.accounting_commercial_documents
  FOR EACH ROW EXECUTE FUNCTION public.accounting_commercial_documents_immutability();

CREATE OR REPLACE FUNCTION public.accounting_vat_periods_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_allow text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'accounting_vat_periods: DELETE fisico vietato'
      USING ERRCODE = 'check_violation';
  END IF;

  v_allow := current_setting('accounting.allow_commercial_mutation', true);

  IF OLD.status IN ('verified', 'paid')
     AND v_allow IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION
      'accounting_vat_periods: status % mutabile solo via RPC (GUC allow_commercial_mutation)'
      , OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_vat_periods_immutability() IS
  'BEFORE UPDATE/DELETE: verified/paid richiedono GUC allow_commercial_mutation=1. '
  'DELETE fisico sempre vietato.';

REVOKE ALL ON FUNCTION public.accounting_vat_periods_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_vat_periods_immutability() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_vat_periods_immutability() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_vat_periods_immutability() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_vat_periods_immutability
  ON public.accounting_vat_periods;
CREATE TRIGGER trg_accounting_vat_periods_immutability
  BEFORE UPDATE OR DELETE ON public.accounting_vat_periods
  FOR EACH ROW EXECUTE FUNCTION public.accounting_vat_periods_immutability();

-- -----------------------------------------------------------------------------
-- 7) Trigger validazione + refresh pagamenti
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_commercial_document_payments_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_doc public.accounting_commercial_documents%ROWTYPE;
  v_mov public.accounting_movements%ROWTYPE;
  v_doc_sum bigint;
  v_mov_sum bigint;
  v_exclude_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.allocated_amount_cents IS NULL OR NEW.allocated_amount_cents <= 0 THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: allocated_amount_cents deve essere > 0'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_doc
  FROM public.accounting_commercial_documents
  WHERE id = NEW.document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: documento % non trovato'
      , NEW.document_id;
  END IF;

  IF v_doc.status NOT IN ('issued', 'partially_collected', 'collected') THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: documento deve essere issued|partially_collected|collected (attuale: %)'
      , v_doc.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_doc.status = 'cancelled' THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: documento cancelled non accettabile'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_mov
  FROM public.accounting_movements
  WHERE id = NEW.movement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: movement % non trovato'
      , NEW.movement_id;
  END IF;

  IF v_mov.direction IS DISTINCT FROM 'income' THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: movement deve avere direction=income'
      USING ERRCODE = 'check_violation';
  END IF;

  v_exclude_id := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;

  SELECT COALESCE(SUM(p.allocated_amount_cents), 0)
  INTO v_doc_sum
  FROM public.accounting_commercial_document_payments p
  WHERE p.document_id = NEW.document_id
    AND (v_exclude_id IS NULL OR p.id IS DISTINCT FROM v_exclude_id);

  IF v_doc_sum + NEW.allocated_amount_cents > v_doc.gross_amount_cents THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: somma allocazioni documento (%) supera gross_amount_cents (%)'
      , v_doc_sum + NEW.allocated_amount_cents, v_doc.gross_amount_cents
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(p.allocated_amount_cents), 0)
  INTO v_mov_sum
  FROM public.accounting_commercial_document_payments p
  WHERE p.movement_id = NEW.movement_id
    AND (v_exclude_id IS NULL OR p.id IS DISTINCT FROM v_exclude_id);

  IF v_mov_sum + NEW.allocated_amount_cents > v_mov.amount_cents THEN
    RAISE EXCEPTION
      'accounting_commercial_document_payments: somma allocazioni movimento (%) supera amount_cents (%)'
      , v_mov_sum + NEW.allocated_amount_cents, v_mov.amount_cents
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_document_payments_validate() IS
  'BEFORE INSERT/UPDATE: documento issued|partially_collected|collected; '
  'movement income; anti over-allocate su documento e movimento.';

DROP TRIGGER IF EXISTS trg_accounting_commercial_document_payments_validate
  ON public.accounting_commercial_document_payments;
CREATE TRIGGER trg_accounting_commercial_document_payments_validate
  BEFORE INSERT OR UPDATE ON public.accounting_commercial_document_payments
  FOR EACH ROW EXECUTE FUNCTION public.accounting_commercial_document_payments_validate();

CREATE OR REPLACE FUNCTION public.accounting_commercial_document_payments_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_doc_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_doc_id := OLD.document_id;
  ELSE
    v_doc_id := NEW.document_id;
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);
  PERFORM public.accounting_commercial_doc_refresh_collection_status(v_doc_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_document_payments_after() IS
  'AFTER INSERT/UPDATE/DELETE: refresh status documento (con GUC mutation).';

DROP TRIGGER IF EXISTS trg_accounting_commercial_document_payments_after
  ON public.accounting_commercial_document_payments;
CREATE TRIGGER trg_accounting_commercial_document_payments_after
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_commercial_document_payments
  FOR EACH ROW EXECUTE FUNCTION public.accounting_commercial_document_payments_after();

-- Se un movimento collegato diventa reversed/cancelled → ricalcola residual documenti
CREATE OR REPLACE FUNCTION public.accounting_commercial_payments_on_movement_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('reversed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounting_commercial_document_payments p
    WHERE p.movement_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  FOR r IN
    SELECT DISTINCT p.document_id
    FROM public.accounting_commercial_document_payments p
    WHERE p.movement_id = NEW.id
  LOOP
    PERFORM public.accounting_commercial_doc_refresh_collection_status(r.document_id);
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_payments_on_movement_status() IS
  'AFTER UPDATE accounting_movements: se status → reversed/cancelled e il movimento '
  'ha allocazioni commerciali, refresh dei documenti collegati (residual aumenta).';

DROP TRIGGER IF EXISTS trg_accounting_commercial_payments_on_movement_status
  ON public.accounting_movements;
CREATE TRIGGER trg_accounting_commercial_payments_on_movement_status
  AFTER UPDATE OF status ON public.accounting_movements
  FOR EACH ROW EXECUTE FUNCTION public.accounting_commercial_payments_on_movement_status();

-- -----------------------------------------------------------------------------
-- 8) Helper fiscali / IVA
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_fiscal_param_resolve(
  p_key text,
  p_on date
)
RETURNS TABLE (
  id uuid,
  value_json jsonb,
  verification_status text,
  valid_from date,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p.id,
    p.value_json,
    p.verification_status,
    p.valid_from,
    p.source
  FROM public.accounting_fiscal_params p
  WHERE p.param_key = p_key
    AND p.valid_from <= p_on
    AND (p.valid_to IS NULL OR p.valid_to >= p_on)
  ORDER BY p.valid_from DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.accounting_fiscal_param_resolve(text, date) IS
  'Risolve il parametro fiscale valido alla data p_on (ultimo valid_from <= p_on '
  'con valid_to NULL o >= p_on). Chiavi ammesse: quelle seedate in 010.';

CREATE OR REPLACE FUNCTION public.accounting_round_half_up_cents(p_numeric numeric)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_numeric IS NULL THEN NULL
    ELSE round(p_numeric)::bigint  -- numeric ROUND: half away from zero
  END;
$$;

COMMENT ON FUNCTION public.accounting_round_half_up_cents(numeric) IS
  'Arrotondamento half_up (half away from zero) a intero centesimi.';

CREATE OR REPLACE FUNCTION public.accounting_vat_from_taxable(
  p_taxable bigint,
  p_basis_points integer,
  p_method text
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_method text := NULLIF(btrim(COALESCE(p_method, '')), '');
BEGIN
  IF p_taxable IS NULL OR p_basis_points IS NULL THEN
    RAISE EXCEPTION 'accounting_vat_from_taxable: taxable e basis_points obbligatori';
  END IF;
  IF p_taxable < 0 OR p_basis_points < 0 THEN
    RAISE EXCEPTION 'accounting_vat_from_taxable: valori negativi non ammessi';
  END IF;
  IF p_basis_points > 10000 THEN
    RAISE EXCEPTION
      'accounting_vat_from_taxable: basis_points max 10000 (100,00%%), ricevuto %'
      , p_basis_points;
  END IF;
  IF v_method IS NULL THEN
    RAISE EXCEPTION
      'accounting_vat_from_taxable: metodo arrotondamento obbligatorio (nessun fallback silenzioso)';
  END IF;

  IF v_method IN ('half_up_cent', 'half_up') THEN
    RETURN public.accounting_round_half_up_cents(
      (p_taxable::numeric * p_basis_points::numeric) / 10000.0
    );
  END IF;

  RAISE EXCEPTION
    'accounting_vat_from_taxable: metodo arrotondamento non supportato: %'
    , v_method;
END;
$$;

COMMENT ON FUNCTION public.accounting_vat_from_taxable(bigint, integer, text) IS
  'IVA in centesimi da imponibile e basis points (2200=22%). '
  'Metodo obbligatorio (no fallback silenzioso). Max bp 10000.';

CREATE OR REPLACE FUNCTION public.accounting_vat_indicative_due_on(
  p_year integer,
  p_quarter integer
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_quarter IS NULL OR p_quarter < 1 OR p_quarter > 4 THEN
    RAISE EXCEPTION 'accounting_vat_indicative_due_on: quarter deve essere 1..4';
  END IF;
  RETURN CASE p_quarter
    WHEN 1 THEN make_date(p_year, 5, 16)
    WHEN 2 THEN make_date(p_year, 8, 20)
    WHEN 3 THEN make_date(p_year, 11, 16)
    WHEN 4 THEN make_date(p_year + 1, 2, 16)
  END;
END;
$$;

COMMENT ON FUNCTION public.accounting_vat_indicative_due_on(integer, integer) IS
  'Scadenza INDICATIVA IVA trimestrale (non normativa). Verificare col commercialista.';

-- Helper interno: categoria SPONSOR/SPONSORIZZAZIONI attiva per movimenti commerciali
CREATE OR REPLACE FUNCTION public.accounting_commercial_preferred_income_category_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.id
  FROM public.accounting_categories c
  WHERE upper(c.code) IN ('SPONSOR', 'SPONSORIZZAZIONI')
    AND c.direction = 'income'
    AND c.is_active IS TRUE
  ORDER BY CASE WHEN upper(c.code) = 'SPONSOR' THEN 0 ELSE 1 END
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.accounting_commercial_preferred_income_category_id() IS
  'Categoria income attiva SPONSOR o SPONSORIZZAZIONI. Nessun fallback silenzioso.';

-- Estrae testo da value_json (number|string|jsonb scalar) senza fallback inventato
CREATE OR REPLACE FUNCTION public.accounting_fiscal_param_text(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN NULL
    WHEN jsonb_typeof(p_value) = 'string' THEN NULLIF(btrim(p_value #>> '{}'), '')
    WHEN jsonb_typeof(p_value) = 'number' THEN (p_value #>> '{}')
    ELSE NULLIF(btrim(p_value #>> '{}'), '')
  END;
$$;

COMMENT ON FUNCTION public.accounting_fiscal_param_text(jsonb) IS
  'Estrae testo/numero da value_json fiscale. Interno (no EXECUTE authenticated).';

CREATE OR REPLACE FUNCTION public.accounting_fiscal_param_numeric(p_value jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_txt text;
BEGIN
  v_txt := public.accounting_fiscal_param_text(p_value);
  IF v_txt IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_txt::numeric;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.accounting_fiscal_param_numeric(jsonb) IS
  'Estrae numeric da value_json fiscale. Interno (no EXECUTE authenticated).';

-- -----------------------------------------------------------------------------
-- 9) RPC documenti commerciali
-- -----------------------------------------------------------------------------
-- Rimuove RPC legacy collect (sostituita da register_payment / link_movement)
DROP FUNCTION IF EXISTS public.accounting_commercial_doc_collect(uuid, uuid, date, uuid);

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

  -- Normalizza numero (btrim); invoice richiede numero non vuoto
  v_num := NULLIF(btrim(COALESCE(v_old.document_number, '')), '');

  IF v_old.document_type = 'invoice' AND v_num IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_issue: document_number obbligatorio e non vuoto per document_type=invoice (documento resta draft)';
  END IF;

  -- Unicità FY + type + numero (esclusi cancelled), messaggio chiaro oltre all'indice
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

  -- Parametro arrotondamento obbligatorio (nessun fallback silenzioso)
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

  -- Coerenza IVA matematica
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

  -- Override aliquota vs parametro proposto: solo manage_settings / Admin
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
      'rate_override', v_old.vat_rate_basis_points IS DISTINCT FROM v_proposed_bp
    )
  );

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_issue(uuid) IS
  'draft → issued. Invoice richiede document_number; unicità FY+type+number '
  '(esclusi cancelled); coerenza IVA vs vat_rounding_method; override aliquota '
  'solo manage_settings/Admin. Nessun fallback fiscale silenzioso.';

CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_cancel(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_commercial_documents%ROWTYPE;
  v_new public.accounting_commercial_documents%ROWTYPE;
  v_collected bigint;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'accounting_commercial_doc_cancel: p_id obbligatorio';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_cancel: utente autenticato richiesto (auth.uid())'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_commercial_documents
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_commercial_doc_cancel: documento % non trovato', p_id;
  END IF;

  IF v_old.status = 'cancelled' THEN
    RAISE EXCEPTION 'accounting_commercial_doc_cancel: documento già cancelled';
  END IF;

  IF v_old.status IN ('partially_collected', 'collected') THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_cancel: documenti partially_collected/collected non cancellabili direttamente. '
      'Stornare/reversare prima i movimenti con allocazioni efficaci; le allocazioni storiche restano.';
  END IF;

  v_collected := public.accounting_commercial_doc_collected_cents(p_id);

  IF v_old.status = 'draft' THEN
    IF NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    ) THEN
      RAISE EXCEPTION
        'accounting_commercial_doc_cancel: per draft serve accounting.edit_draft o Admin'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF v_old.status = 'issued' THEN
    IF v_collected > 0 THEN
      RAISE EXCEPTION
        'accounting_commercial_doc_cancel: documento issued con incassi efficaci (%) non cancellabile. '
        'Stornare/reversare i movimenti collegati prima; nessuna eliminazione storica delle allocazioni.'
        , v_collected;
    END IF;
    IF NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    ) THEN
      RAISE EXCEPTION
        'accounting_commercial_doc_cancel: per issued senza incassi serve accounting.post o Admin '
        '(edit_draft non sufficiente)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSE
    RAISE EXCEPTION
      'accounting_commercial_doc_cancel: status non gestito: %', v_old.status;
  END IF;

  -- Soft cancel: conserva le righe payment storiche; non elimina movimenti.
  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_commercial_documents
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = v_uid,
      updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_commercial_documents',
    p_id,
    'commercial_doc_cancelled',
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULL,
    'ui',
    NULL,
    jsonb_build_object(
      'from_status', v_old.status,
      'to_status', 'cancelled',
      'payments_kept', true,
      'effective_collected_at_cancel', v_collected
    )
  );

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_cancel(uuid) IS
  'Soft cancel. draft: edit_draft/Admin. issued senza incassi efficaci: post/Admin. '
  'partially_collected/collected o issued con incassi: bloccato. '
  'Non elimina movimenti né allocazioni storiche.';

CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_register_payment(
  p_document_id uuid,
  p_account_id uuid,
  p_allocated_amount_cents bigint,
  p_movement_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc public.accounting_commercial_documents%ROWTYPE;
  v_doc_after public.accounting_commercial_documents%ROWTYPE;
  v_fy public.accounting_fiscal_years%ROWTYPE;
  v_acc public.accounting_accounts%ROWTYPE;
  v_mov_id uuid;
  v_pay_id uuid;
  v_cat_id uuid;
  v_mov_date date;
  v_collected bigint;
  v_residual bigint;
BEGIN
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'accounting_commercial_doc_register_payment: p_document_id obbligatorio';
  END IF;
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'accounting_commercial_doc_register_payment: p_account_id obbligatorio';
  END IF;
  IF p_allocated_amount_cents IS NULL OR p_allocated_amount_cents <= 0 THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: p_allocated_amount_cents deve essere > 0';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: permesso accounting.post o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: utente autenticato richiesto (auth.uid())'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_doc
  FROM public.accounting_commercial_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: documento % non trovato', p_document_id;
  END IF;

  IF v_doc.status NOT IN ('issued', 'partially_collected') THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: status deve essere issued|partially_collected (attuale: %)'
      , v_doc.status;
  END IF;

  SELECT * INTO v_fy
  FROM public.accounting_fiscal_years
  WHERE id = v_doc.fiscal_year_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: esercizio % non trovato', v_doc.fiscal_year_id;
  END IF;

  IF v_fy.status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: esercizio non aperto (status=%); nessuna creazione su esercizio chiuso'
      , v_fy.status;
  END IF;

  SELECT * INTO v_acc
  FROM public.accounting_accounts
  WHERE id = p_account_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: account % non trovato', p_account_id;
  END IF;

  IF v_acc.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: account % non attivo', p_account_id;
  END IF;

  IF upper(COALESCE(v_acc.currency, '')) IS DISTINCT FROM 'EUR' THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: valuta account deve essere EUR (attuale: %)'
      , v_acc.currency;
  END IF;

  v_mov_date := COALESCE(p_movement_date, CURRENT_DATE);

  IF v_mov_date < v_fy.starts_on OR v_mov_date > v_fy.ends_on THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: movement_date % fuori dall''esercizio [% .. %]'
      , v_mov_date, v_fy.starts_on, v_fy.ends_on;
  END IF;

  v_collected := public.accounting_commercial_doc_collected_cents(p_document_id);
  v_residual := v_doc.gross_amount_cents - v_collected;

  IF v_residual <= 0 THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: residual già zero (documento già collected)';
  END IF;

  IF p_allocated_amount_cents > v_residual THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: allocato (%) supera residual (%)'
      , p_allocated_amount_cents, v_residual;
  END IF;

  v_cat_id := public.accounting_commercial_preferred_income_category_id();
  IF v_cat_id IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: categoria SPONSOR/SPONSORIZZAZIONI attiva assente';
  END IF;

  IF v_doc.document_type = 'invoice'
     AND (v_doc.document_number IS NULL OR btrim(v_doc.document_number) = '') THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_register_payment: document_number obbligatorio per document_type=invoice';
  END IF;

  -- Crea movimento income posted per l'importo ALLOCATO (non necessariamente il gross pieno)
  INSERT INTO public.accounting_movements (
    fiscal_year_id,
    movement_date,
    document_date,
    settlement_date,
    direction,
    amount_cents,
    currency,
    account_id,
    category_id,
    counterparty_id,
    description,
    notes,
    origin,
    status,
    document_type,
    document_number,
    posted_at,
    posted_by,
    created_by,
    updated_by
  ) VALUES (
    v_doc.fiscal_year_id,
    v_mov_date,
    v_doc.document_date,
    v_mov_date,
    'income',
    p_allocated_amount_cents,
    'EUR',
    p_account_id,
    v_cat_id,
    v_doc.counterparty_id,
    v_doc.description,
    v_doc.notes,
    'manual',
    'posted',
    v_doc.document_type,
    v_doc.document_number,
    now(),
    v_uid,
    v_uid,
    v_uid
  )
  RETURNING id INTO v_mov_id;

  INSERT INTO public.accounting_commercial_document_payments (
    document_id,
    movement_id,
    allocated_amount_cents,
    created_by
  ) VALUES (
    p_document_id,
    v_mov_id,
    p_allocated_amount_cents,
    v_uid
  )
  RETURNING id INTO v_pay_id;

  -- AFTER trigger già fa refresh; rileggi stato
  SELECT * INTO v_doc_after
  FROM public.accounting_commercial_documents
  WHERE id = p_document_id;

  v_collected := public.accounting_commercial_doc_collected_cents(p_document_id);
  v_residual := v_doc_after.gross_amount_cents - v_collected;

  PERFORM public.accounting_audit_write(
    'accounting_commercial_documents',
    p_document_id,
    'commercial_doc_payment_registered',
    to_jsonb(v_doc),
    to_jsonb(v_doc_after),
    NULL,
    'ui',
    NULL,
    jsonb_build_object(
      'payment_id', v_pay_id,
      'movement_id', v_mov_id,
      'allocated_amount_cents', p_allocated_amount_cents,
      'collected', v_collected,
      'residual', v_residual,
      'status', v_doc_after.status,
      'legacy_movement_id_untouched', true
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_pay_id,
    'movement_id', v_mov_id,
    'collected', v_collected,
    'residual', v_residual,
    'status', v_doc_after.status
  );
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_register_payment(uuid, uuid, bigint, date) IS
  'Registra pagamento parziale/pieno: crea movimento income posted = allocato. '
  'Richiede esercizio open, account attivo EUR, data in FY, categoria SPONSOR attiva. '
  'NON imposta documents.movement_id (legacy). Richiede accounting.post o Admin.';

CREATE OR REPLACE FUNCTION public.accounting_commercial_doc_link_movement(
  p_document_id uuid,
  p_movement_id uuid,
  p_allocated_amount_cents bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_doc public.accounting_commercial_documents%ROWTYPE;
  v_doc_after public.accounting_commercial_documents%ROWTYPE;
  v_mov public.accounting_movements%ROWTYPE;
  v_pay_id uuid;
  v_collected bigint;
  v_residual bigint;
  v_already bigint;
BEGIN
  IF p_document_id IS NULL OR p_movement_id IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: document_id e movement_id obbligatori';
  END IF;
  IF p_allocated_amount_cents IS NULL OR p_allocated_amount_cents <= 0 THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: p_allocated_amount_cents deve essere > 0';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: permesso accounting.post o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: utente autenticato richiesto (auth.uid())'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_doc
  FROM public.accounting_commercial_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: documento % non trovato', p_document_id;
  END IF;

  IF v_doc.status NOT IN ('issued', 'partially_collected', 'collected') THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: status documento non collegabile (attuale: %)'
      , v_doc.status;
  END IF;

  SELECT * INTO v_mov
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: movement % non trovato', p_movement_id;
  END IF;

  IF v_mov.status IS DISTINCT FROM 'posted' THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: movement deve avere status=posted (attuale: %; reversed/cancelled non ammessi)'
      , v_mov.status;
  END IF;

  IF v_mov.direction IS DISTINCT FROM 'income' THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: movement deve avere direction=income';
  END IF;

  IF v_mov.fiscal_year_id IS DISTINCT FROM v_doc.fiscal_year_id THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: fiscal_year del movimento non corrisponde al documento';
  END IF;

  IF v_mov.account_id IS NULL THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: movement senza account_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_accounts a WHERE a.id = v_mov.account_id
  ) THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: account del movimento non trovato';
  END IF;

  -- Controlli espliciti (oltre al trigger) per messaggio chiaro
  IF (
    SELECT COALESCE(SUM(p.allocated_amount_cents), 0)
    FROM public.accounting_commercial_document_payments p
    WHERE p.document_id = p_document_id
  ) + p_allocated_amount_cents > v_doc.gross_amount_cents THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: over-allocate sul documento (gross %)'
      , v_doc.gross_amount_cents;
  END IF;

  v_already := public.accounting_commercial_movement_allocated_cents(p_movement_id);
  IF v_already + p_allocated_amount_cents > v_mov.amount_cents THEN
    RAISE EXCEPTION
      'accounting_commercial_doc_link_movement: importo disponibile insufficiente sul movimento (già allocato %, amount %, richiesto %)'
      , v_already, v_mov.amount_cents, p_allocated_amount_cents;
  END IF;

  INSERT INTO public.accounting_commercial_document_payments (
    document_id,
    movement_id,
    allocated_amount_cents,
    created_by
  ) VALUES (
    p_document_id,
    p_movement_id,
    p_allocated_amount_cents,
    v_uid
  )
  RETURNING id INTO v_pay_id;
  -- UNIQUE(document_id, movement_id) blocca doppio link

  SELECT * INTO v_doc_after
  FROM public.accounting_commercial_documents
  WHERE id = p_document_id;

  v_collected := public.accounting_commercial_doc_collected_cents(p_document_id);
  v_residual := v_doc_after.gross_amount_cents - v_collected;

  PERFORM public.accounting_audit_write(
    'accounting_commercial_documents',
    p_document_id,
    'commercial_doc_movement_linked',
    to_jsonb(v_doc),
    to_jsonb(v_doc_after),
    NULL,
    'ui',
    NULL,
    jsonb_build_object(
      'payment_id', v_pay_id,
      'movement_id', p_movement_id,
      'allocated_amount_cents', p_allocated_amount_cents,
      'collected', v_collected,
      'residual', v_residual,
      'status', v_doc_after.status,
      'legacy_movement_id_untouched', true
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_pay_id,
    'movement_id', p_movement_id,
    'collected', v_collected,
    'residual', v_residual,
    'status', v_doc_after.status
  );
END;
$$;

COMMENT ON FUNCTION public.accounting_commercial_doc_link_movement(uuid, uuid, bigint) IS
  'Collega movimento income posted esistente. Stesso FY, account presente, '
  'importo disponibile sufficiente. Anti over-allocate + UNIQUE(doc,mov). '
  'NON setta documents.movement_id.';

-- -----------------------------------------------------------------------------
-- 10) RPC periodi IVA
-- Momento impositivo: document_date (ipotesi gestionale; conferma commercialista).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_vat_period_calculate(
  p_fiscal_year_id uuid,
  p_year integer,
  p_quarter integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_can_write boolean;
  v_as_of date;
  v_taxable bigint := 0;
  v_output_vat bigint := 0;
  v_forfait bigint := 0;
  v_due bigint := 0;
  v_pct numeric;
  v_param record;
  v_snapshot jsonb := '[]'::jsonb;
  -- Chiavi ESATTE seedate in 010 — non inventare altre
  v_keys text[] := ARRAY[
    'commercial_revenue_limit',
    'vat_flat_deduction_pct',
    'vat_periodicity',
    'vat_rate_sponsorship',
    'vat_rounding_method'
  ];
  v_key text;
  v_existing public.accounting_vat_periods%ROWTYPE;
  v_id uuid;
  v_due_on date;
  v_row jsonb;
  v_missing_flat boolean := false;
BEGIN
  IF p_fiscal_year_id IS NULL OR p_year IS NULL OR p_quarter IS NULL THEN
    RAISE EXCEPTION
      'accounting_vat_period_calculate: fiscal_year_id, year e quarter obbligatori';
  END IF;

  IF p_quarter < 1 OR p_quarter > 4 THEN
    RAISE EXCEPTION 'accounting_vat_period_calculate: quarter deve essere 1..4';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
    OR public.has_accounting_permission('accounting.create')
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.verify')
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_vat_period_calculate: permesso accounting.view (o superiore) richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_fiscal_years fy WHERE fy.id = p_fiscal_year_id
  ) THEN
    RAISE EXCEPTION
      'accounting_vat_period_calculate: fiscal_year % non trovato', p_fiscal_year_id;
  END IF;

  v_can_write :=
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.create')
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.verify')
    OR public.has_accounting_permission('accounting.post');

  -- Ultimo giorno del trimestre (per risoluzione parametri)
  v_as_of := CASE p_quarter
    WHEN 1 THEN make_date(p_year, 3, 31)
    WHEN 2 THEN make_date(p_year, 6, 30)
    WHEN 3 THEN make_date(p_year, 9, 30)
    WHEN 4 THEN make_date(p_year, 12, 31)
  END;

  -- Momento impositivo = document_date (ipotesi gestionale; conferma commercialista).
  -- Include issued / partially_collected / collected (non draft/cancelled).
  SELECT
    COALESCE(SUM(d.taxable_amount_cents), 0),
    COALESCE(SUM(d.vat_amount_cents), 0)
  INTO v_taxable, v_output_vat
  FROM public.accounting_commercial_documents d
  WHERE d.fiscal_year_id = p_fiscal_year_id
    AND d.status IN ('issued', 'partially_collected', 'collected')
    AND EXTRACT(YEAR FROM d.document_date)::integer = p_year
    AND EXTRACT(QUARTER FROM d.document_date)::integer = p_quarter;

  -- Snapshot parametri rilevanti (sempre con verification_status)
  FOREACH v_key IN ARRAY v_keys LOOP
    SELECT * INTO v_param
    FROM public.accounting_fiscal_param_resolve(v_key, v_as_of);

    IF v_param.id IS NOT NULL THEN
      v_snapshot := v_snapshot || jsonb_build_array(
        jsonb_build_object(
          'param_key', v_key,
          'id', v_param.id,
          'value_json', v_param.value_json,
          'verification_status', v_param.verification_status,
          'valid_from', v_param.valid_from,
          'source', v_param.source,
          'resolved_as_of', v_as_of
        )
      );
    ELSE
      v_snapshot := v_snapshot || jsonb_build_array(
        jsonb_build_object(
          'param_key', v_key,
          'id', NULL,
          'value_json', NULL,
          'verification_status', 'missing',
          'valid_from', NULL,
          'source', NULL,
          'resolved_as_of', v_as_of
        )
      );
    END IF;
  END LOOP;

  SELECT * INTO v_param
  FROM public.accounting_fiscal_param_resolve('vat_flat_deduction_pct', v_as_of);

  IF v_param.id IS NULL OR v_param.value_json IS NULL THEN
    v_missing_flat := true;
    -- View-only / simulazione: restituisce flag missing senza raise.
    -- Save (write): richiede parametro presente.
    IF v_can_write THEN
      RAISE EXCEPTION
        'accounting_vat_period_calculate: parametro vat_flat_deduction_pct assente alla data % '
        '(obbligatorio per salvare; simulazione view-only consentita solo senza permesso write)'
        , v_as_of;
    END IF;

    v_row := jsonb_build_object(
      'fiscal_year_id', p_fiscal_year_id,
      'year', p_year,
      'quarter', p_quarter,
      'commercial_taxable_cents', v_taxable,
      'output_vat_cents', v_output_vat,
      'forfait_deduction_cents', NULL,
      'estimated_vat_due_cents', NULL,
      'indicative_due_on', public.accounting_vat_indicative_due_on(p_year, p_quarter),
      'param_snapshot', v_snapshot,
      'as_of', v_as_of,
      'momento_impositivo', 'document_date',
      'momento_impositivo_disclaimer',
        'Ipotesi gestionale: attribuzione trimestre su document_date. Confermare col commercialista.',
      'saved', false,
      'status', 'simulation',
      'missing_vat_flat_deduction_pct', true
    );
    RETURN v_row;
  END IF;

  BEGIN
    v_pct := (v_param.value_json #>> '{}')::numeric;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION
      'accounting_vat_period_calculate: vat_flat_deduction_pct non numerico: %'
      , v_param.value_json;
  END;

  v_forfait := public.accounting_round_half_up_cents(
    (v_output_vat::numeric * v_pct) / 100.0
  );
  v_due := GREATEST(0, v_output_vat - v_forfait);
  v_due_on := public.accounting_vat_indicative_due_on(p_year, p_quarter);

  v_row := jsonb_build_object(
    'fiscal_year_id', p_fiscal_year_id,
    'year', p_year,
    'quarter', p_quarter,
    'commercial_taxable_cents', v_taxable,
    'output_vat_cents', v_output_vat,
    'forfait_deduction_cents', v_forfait,
    'estimated_vat_due_cents', v_due,
    'indicative_due_on', v_due_on,
    'param_snapshot', v_snapshot,
    'as_of', v_as_of,
    'momento_impositivo', 'document_date',
    'momento_impositivo_disclaimer',
      'Ipotesi gestionale: attribuzione trimestre su document_date. Confermare col commercialista.',
    'missing_vat_flat_deduction_pct', false
  );

  -- Parametri non verified: calculate/simulazione OK; verify RPC rifiuterà.
  IF NOT v_can_write THEN
    RETURN v_row || jsonb_build_object('saved', false, 'status', 'simulation');
  END IF;

  SELECT * INTO v_existing
  FROM public.accounting_vat_periods
  WHERE fiscal_year_id = p_fiscal_year_id
    AND year = p_year
    AND quarter = p_quarter
  FOR UPDATE;

  IF FOUND AND v_existing.status IN ('verified', 'paid') THEN
    RAISE EXCEPTION
      'accounting_vat_period_calculate: periodo già % — ricalcolo rifiutato (niente overwrite)'
      , v_existing.status;
  END IF;

  IF FOUND THEN
    UPDATE public.accounting_vat_periods
    SET commercial_taxable_cents = v_taxable,
        output_vat_cents = v_output_vat,
        forfait_deduction_cents = v_forfait,
        estimated_vat_due_cents = v_due,
        indicative_due_on = v_due_on,
        param_snapshot = v_snapshot,
        status = 'calculated',
        verified_at = NULL,
        verified_by = NULL,
        paid_at = NULL,
        payment_reference = NULL,
        updated_by = v_uid
    WHERE id = v_existing.id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.accounting_vat_periods (
      fiscal_year_id, year, quarter, status,
      commercial_taxable_cents, output_vat_cents,
      forfait_deduction_cents, estimated_vat_due_cents,
      indicative_due_on, param_snapshot,
      created_by, updated_by
    ) VALUES (
      p_fiscal_year_id, p_year, p_quarter, 'calculated',
      v_taxable, v_output_vat,
      v_forfait, v_due,
      v_due_on, v_snapshot,
      v_uid, v_uid
    )
    RETURNING id INTO v_id;
  END IF;

  PERFORM public.accounting_audit_write(
    'accounting_vat_periods',
    v_id,
    'vat_period_calculated',
    CASE WHEN v_existing.id IS NOT NULL THEN to_jsonb(v_existing) ELSE NULL END,
    v_row || jsonb_build_object('id', v_id, 'status', 'calculated'),
    NULL,
    'ui',
    NULL,
    NULL
  );

  RETURN v_row || jsonb_build_object(
    'saved', true,
    'id', v_id,
    'status', 'calculated'
  );
END;
$$;

COMMENT ON FUNCTION public.accounting_vat_period_calculate(uuid, integer, integer) IS
  'Calcola stima IVA trimestre da documenti issued|partially_collected|collected '
  'attribuiti per document_date (momento impositivo ipotesi gestionale). '
  'view-only → simulazione; write → upsert calculated. '
  'vat_flat_deduction_pct assente: simulazione con flag se solo view, raise se save. '
  'Param non verified: calculate OK; verify rifiuta. Rifiuta overwrite verified/paid.';

CREATE OR REPLACE FUNCTION public.accounting_vat_period_verify(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_vat_periods%ROWTYPE;
  v_new public.accounting_vat_periods%ROWTYPE;
  v_elem jsonb;
  v_unverif text[] := ARRAY[]::text[];
  v_key text;
  v_status text;
  v_required text[] := ARRAY[
    'commercial_revenue_limit',
    'vat_flat_deduction_pct',
    'vat_periodicity',
    'vat_rate_sponsorship',
    'vat_rounding_method'
  ];
  v_present text[] := ARRAY[]::text[];
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'accounting_vat_period_verify: p_id obbligatorio';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.verify')
  ) THEN
    RAISE EXCEPTION
      'accounting_vat_period_verify: permesso accounting.verify o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_vat_period_verify: utente autenticato richiesto (auth.uid())'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_vat_periods
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_vat_period_verify: periodo % non trovato', p_id;
  END IF;

  IF v_old.status IS DISTINCT FROM 'calculated' THEN
    RAISE EXCEPTION
      'accounting_vat_period_verify: status deve essere calculated (attuale: %)'
      , v_old.status;
  END IF;

  FOR v_elem IN
    SELECT value
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(v_old.param_snapshot) = 'array' THEN v_old.param_snapshot
        ELSE '[]'::jsonb
      END
    )
  LOOP
    v_key := v_elem->>'param_key';
    v_status := v_elem->>'verification_status';
    IF v_key IS NOT NULL THEN
      v_present := array_append(v_present, v_key);
    END IF;
    IF v_status IS DISTINCT FROM 'verified' THEN
      v_unverif := array_append(
        v_unverif,
        format('%s=%s', COALESCE(v_key, '?'), COALESCE(v_status, 'null'))
      );
    END IF;
  END LOOP;

  FOREACH v_key IN ARRAY v_required LOOP
    IF NOT (v_key = ANY (v_present)) THEN
      v_unverif := array_append(v_unverif, format('%s=absent_from_snapshot', v_key));
    END IF;
  END LOOP;

  IF cardinality(v_unverif) > 0 THEN
    RAISE EXCEPTION
      'accounting_vat_period_verify: parametri nello snapshot non tutti verified: %. '
      'Confermare i parametri fiscali con il commercialista prima della verifica.'
      , array_to_string(v_unverif, ', ');
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_vat_periods
  SET status = 'verified',
      verified_at = now(),
      verified_by = v_uid,
      updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_vat_periods',
    p_id,
    'vat_period_verified',
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

COMMENT ON FUNCTION public.accounting_vat_period_verify(uuid) IS
  'calculated → verified. Richiede le 5 chiavi 010 nello snapshot tutte verification_status=verified.';

CREATE OR REPLACE FUNCTION public.accounting_vat_period_mark_paid(
  p_id uuid,
  p_paid_at timestamptz,
  p_payment_reference text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_vat_periods%ROWTYPE;
  v_new public.accounting_vat_periods%ROWTYPE;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'accounting_vat_period_mark_paid: p_id obbligatorio';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_vat_period_mark_paid: permesso accounting.post o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_vat_period_mark_paid: utente autenticato richiesto (auth.uid())'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_vat_periods
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_vat_period_mark_paid: periodo % non trovato', p_id;
  END IF;

  IF v_old.status IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION
      'accounting_vat_period_mark_paid: status deve essere verified (attuale: %)'
      , v_old.status;
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_vat_periods
  SET status = 'paid',
      paid_at = COALESCE(p_paid_at, now()),
      payment_reference = NULLIF(btrim(p_payment_reference), ''),
      updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_vat_periods',
    p_id,
    'vat_period_marked_paid',
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

COMMENT ON FUNCTION public.accounting_vat_period_mark_paid(uuid, timestamptz, text) IS
  'verified → paid. Richiede accounting.post o Admin. Solo gestionale (non F24).';

-- -----------------------------------------------------------------------------
-- 11) GRANT / REVOKE funzioni
-- RPC pubbliche → authenticated + service_role
-- Helper / trigger interni → solo service_role (trigger non richiedono GRANT client)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_public text[] := ARRAY[
    'accounting_commercial_doc_issue',
    'accounting_commercial_doc_cancel',
    'accounting_commercial_doc_register_payment',
    'accounting_commercial_doc_link_movement',
    'accounting_vat_period_calculate',
    'accounting_vat_period_verify',
    'accounting_vat_period_mark_paid'
  ];
  v_internal text[] := ARRAY[
    'accounting_fiscal_param_resolve',
    'accounting_fiscal_param_text',
    'accounting_fiscal_param_numeric',
    'accounting_round_half_up_cents',
    'accounting_vat_from_taxable',
    'accounting_vat_indicative_due_on',
    'accounting_commercial_payment_is_effective',
    'accounting_commercial_doc_collected_cents',
    'accounting_commercial_movement_allocated_cents',
    'accounting_commercial_doc_refresh_collection_status',
    'accounting_commercial_preferred_income_category_id',
    'accounting_commercial_document_payments_validate',
    'accounting_commercial_document_payments_after',
    'accounting_commercial_payments_on_movement_status',
    'accounting_commercial_documents_immutability',
    'accounting_vat_periods_immutability'
  ];
BEGIN
  -- RPC frontend
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (v_public)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;

  -- Helper / trigger interni: nessun EXECUTE a authenticated
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (v_internal)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 12) GRANT / REVOKE tabelle
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounting_commercial_documents FROM anon;
REVOKE ALL ON TABLE public.accounting_commercial_document_payments FROM anon;
REVOKE ALL ON TABLE public.accounting_vat_periods FROM anon;

REVOKE ALL ON TABLE public.accounting_commercial_documents FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_commercial_document_payments FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_vat_periods FROM PUBLIC;

REVOKE ALL ON TABLE public.accounting_commercial_documents FROM authenticated;
REVOKE ALL ON TABLE public.accounting_commercial_document_payments FROM authenticated;
REVOKE ALL ON TABLE public.accounting_vat_periods FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_commercial_documents TO authenticated;
-- Nessun GRANT DELETE: soft cancel via RPC.

-- payments: SOLO SELECT per authenticated (mutazioni solo RPC SECURITY DEFINER)
GRANT SELECT ON TABLE public.accounting_commercial_document_payments TO authenticated;

GRANT SELECT ON TABLE public.accounting_vat_periods TO authenticated;
-- Mutazioni vat_periods solo via RPC SECURITY DEFINER (bypass RLS).

GRANT ALL ON TABLE public.accounting_commercial_documents TO service_role;
GRANT ALL ON TABLE public.accounting_commercial_document_payments TO service_role;
GRANT ALL ON TABLE public.accounting_vat_periods TO service_role;

-- -----------------------------------------------------------------------------
-- 13) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_commercial_document_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_vat_periods ENABLE ROW LEVEL SECURITY;

-- --- commercial_documents SELECT ---
DROP POLICY IF EXISTS accounting_commercial_documents_select
  ON public.accounting_commercial_documents;
CREATE POLICY accounting_commercial_documents_select
  ON public.accounting_commercial_documents
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- --- commercial_documents INSERT (solo draft) ---
DROP POLICY IF EXISTS accounting_commercial_documents_insert
  ON public.accounting_commercial_documents;
CREATE POLICY accounting_commercial_documents_insert
  ON public.accounting_commercial_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
    )
    AND status = 'draft'
  );

-- --- commercial_documents UPDATE draft→draft ---
DROP POLICY IF EXISTS accounting_commercial_documents_update_draft
  ON public.accounting_commercial_documents;
CREATE POLICY accounting_commercial_documents_update_draft
  ON public.accounting_commercial_documents
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

-- Nessuna policy client UPDATE per issued/partially_collected/collected/cancelled (solo RPC).
-- Nessuna policy DELETE.

-- --- payments SELECT ---
DROP POLICY IF EXISTS accounting_commercial_document_payments_select
  ON public.accounting_commercial_document_payments;
CREATE POLICY accounting_commercial_document_payments_select
  ON public.accounting_commercial_document_payments
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- Nessuna policy INSERT/UPDATE/DELETE su payments per authenticated:
-- mutazioni solo via RPC SECURITY DEFINER.

-- --- vat_periods SELECT ---
DROP POLICY IF EXISTS accounting_vat_periods_select
  ON public.accounting_vat_periods;
CREATE POLICY accounting_vat_periods_select
  ON public.accounting_vat_periods
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- Nessuna policy INSERT/UPDATE/DELETE su vat_periods per authenticated:
-- mutazioni solo via RPC SECURITY DEFINER.

-- Ricarica schema PostgREST (evita 400/404 API su tabelle nuove)
NOTIFY pgrst, 'reload schema';

COMMIT;
