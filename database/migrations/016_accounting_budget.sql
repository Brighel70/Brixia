-- =============================================================================
-- 016_accounting_budget.sql
-- =============================================================================
-- STEP 4A — Bilancio preventivo per esercizio.
--
-- Crea:
--   - accounting_budgets
--   - accounting_budget_lines (solo righe manuali)
--   - trigger: vieta category QUOTE sulle righe budget
--   - trigger: su approvazione forza approved_at / approved_by = auth.uid()
--
-- Quote automatiche (fees_live):
--   NON vengono salvate come righe budget. Il previsto Quote è calcolato in
--   lettura da accounting_receivables (SUM expected/collected/residual,
--   status <> cancelled, archived_at IS NULL). Così non si duplica la
--   categoria QUOTE con una riga modificabile.
--
-- Vincolo: al più un preventivo draft|approved per fiscal_year_id
-- (versioni storiche = status archived).
--
-- Permessi riusati (nessun permesso nuovo):
--   accounting.view       → SELECT
--   accounting.create     → INSERT budget (+ prima bozza)
--   accounting.edit_draft → UPDATE/DELETE bozza e righe manuali
--   accounting.post       → approvazione (draft → approved)
--
-- NON modifica: Quote, FlowMe, movements, receivables, migration 010–015.
-- NON APPLICARE senza revisione e approvazione.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) accounting_budgets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'archived')),
  version integer NOT NULL DEFAULT 1
    CHECK (version > 0),
  notes text NULL,
  approved_at timestamptz NULL,
  approved_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_budgets_name_nonempty
    CHECK (btrim(name) <> ''),
  CONSTRAINT accounting_budgets_approved_fields
    CHECK (
      (status = 'draft' AND approved_at IS NULL AND approved_by IS NULL)
      OR (status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
      OR (status = 'archived')
    )
);

COMMENT ON TABLE public.accounting_budgets IS
  'Bilancio preventivo per esercizio. Un solo draft|approved attivo per FY '
  '(indice parziale). Quote non sono righe: calcolate live dai receivable.';

COMMENT ON COLUMN public.accounting_budgets.status IS
  'draft = modificabile; approved = congelato; archived = versione storica.';

COMMENT ON COLUMN public.accounting_budgets.version IS
  'Numero versione monotono per esercizio (1, 2, …).';

COMMENT ON COLUMN public.accounting_budgets.approved_by IS
  'Impostato solo dal trigger accounting_budget_stamp_approval da auth.uid(); '
  'il client non può scegliere un altro profilo.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_budgets_active_fy
  ON public.accounting_budgets (fiscal_year_id)
  WHERE status IN ('draft', 'approved');

CREATE INDEX IF NOT EXISTS idx_accounting_budgets_fiscal_year
  ON public.accounting_budgets (fiscal_year_id);

CREATE INDEX IF NOT EXISTS idx_accounting_budgets_status
  ON public.accounting_budgets (status);

DROP TRIGGER IF EXISTS trg_accounting_budgets_updated_at
  ON public.accounting_budgets;
CREATE TRIGGER trg_accounting_budgets_updated_at
  BEFORE UPDATE ON public.accounting_budgets
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 1b) Approvazione: forza approved_at / approved_by (nessuna identità client)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_budget_stamp_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Transizione draft → approved: solo auth.uid() e now().
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION
        'accounting_budgets: approvazione richiede utente autenticato (auth.uid())'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.approved_at := now();
    NEW.approved_by := v_uid;
  END IF;

  -- Impedisce di alterare i campi di approvazione fuori dalla transizione.
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'approved'
     AND NEW.status = 'approved'
     AND (
       NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     ) THEN
    RAISE EXCEPTION
      'accounting_budgets: approved_at/approved_by non modificabili dopo approvazione'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Da draft non si possono impostare approved_* senza passare da status approved
  -- (il trigger di approvazione li valorizza; qui si azzera tentativi spurî).
  IF NEW.status = 'draft' THEN
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_budget_stamp_approval() IS
  'BEFORE INSERT/UPDATE accounting_budgets: su draft→approved imposta '
  'approved_at=now() e approved_by=auth.uid(). Il client non sceglie approved_by.';

REVOKE ALL ON FUNCTION public.accounting_budget_stamp_approval() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_budget_stamp_approval() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_budget_stamp_approval() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_budget_stamp_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_budget_stamp_approval() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_budgets_stamp_approval
  ON public.accounting_budgets;
CREATE TRIGGER trg_accounting_budgets_stamp_approval
  BEFORE INSERT OR UPDATE ON public.accounting_budgets
  FOR EACH ROW EXECUTE FUNCTION public.accounting_budget_stamp_approval();

-- -----------------------------------------------------------------------------
-- 2) accounting_budget_lines
-- Solo source_type = manual in Step 4A. fees_live è virtuale (vedi header).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL
    REFERENCES public.accounting_budgets(id) ON DELETE CASCADE,
  category_id uuid NOT NULL
    REFERENCES public.accounting_categories(id) ON DELETE RESTRICT,
  direction text NOT NULL
    CHECK (direction IN ('income', 'expense')),
  description text NOT NULL,
  planned_amount_cents bigint NOT NULL
    CHECK (planned_amount_cents > 0),
  sort_order integer NOT NULL DEFAULT 0,
  notes text NULL,
  source_type text NOT NULL DEFAULT 'manual'
    CHECK (source_type IN ('manual', 'fees_live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounting_budget_lines_description_nonempty
    CHECK (btrim(description) <> ''),
  -- Step 4A: vietare persistenza fees_live (evita duplicazione Quote).
  CONSTRAINT accounting_budget_lines_manual_only
    CHECK (source_type = 'manual')
);

COMMENT ON TABLE public.accounting_budget_lines IS
  'Voci manuali del preventivo. Le Quote (fees_live) NON si inseriscono qui: '
  'sono aggregate dinamicamente da accounting_receivables in UI/API. '
  'La categoria QUOTE è vietata dal trigger accounting_budget_forbid_quote_category.';

COMMENT ON COLUMN public.accounting_budget_lines.source_type IS
  'manual = riga editabile. fees_live riservato/bloccato dal CHECK '
  'accounting_budget_lines_manual_only (calcolo live fuori tabella).';

COMMENT ON COLUMN public.accounting_budget_lines.planned_amount_cents IS
  'Importo previsto in centesimi (> 0).';

CREATE INDEX IF NOT EXISTS idx_accounting_budget_lines_budget
  ON public.accounting_budget_lines (budget_id);

CREATE INDEX IF NOT EXISTS idx_accounting_budget_lines_category
  ON public.accounting_budget_lines (category_id);

DROP TRIGGER IF EXISTS trg_accounting_budget_lines_updated_at
  ON public.accounting_budget_lines;
CREATE TRIGGER trg_accounting_budget_lines_updated_at
  BEFORE UPDATE ON public.accounting_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 2b) Vietare category_id → accounting_categories.code = 'QUOTE'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_budget_forbid_quote_category()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT c.code
  INTO v_code
  FROM public.accounting_categories c
  WHERE c.id = NEW.category_id;

  IF v_code IS NULL THEN
    RAISE EXCEPTION
      'accounting_budget_lines: category_id non valido'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF upper(v_code) = 'QUOTE' THEN
    RAISE EXCEPTION
      'accounting_budget_lines: la categoria QUOTE è calcolata automaticamente dalle Quote; non inserire voci manuali'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_budget_forbid_quote_category() IS
  'BEFORE INSERT/UPDATE accounting_budget_lines: rifiuta category_id con code QUOTE. '
  'Le Quote restano aggregate live dai receivable; nessun effetto su altre categorie.';

REVOKE ALL ON FUNCTION public.accounting_budget_forbid_quote_category() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_budget_forbid_quote_category() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_budget_forbid_quote_category() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_budget_forbid_quote_category() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_budget_forbid_quote_category() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_budget_forbid_quote_category
  ON public.accounting_budget_lines;
CREATE TRIGGER trg_accounting_budget_forbid_quote_category
  BEFORE INSERT OR UPDATE OF category_id ON public.accounting_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_budget_forbid_quote_category();

-- -----------------------------------------------------------------------------
-- 3) GRANT / REVOKE — minimo privilegio
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounting_budgets FROM anon;
REVOKE ALL ON TABLE public.accounting_budget_lines FROM anon;

REVOKE ALL ON TABLE public.accounting_budgets FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_budget_lines FROM PUBLIC;

REVOKE ALL ON TABLE public.accounting_budgets FROM authenticated;
REVOKE ALL ON TABLE public.accounting_budget_lines FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_budgets TO authenticated;
-- DELETE budget: non necessario in 4A (si archivia via UPDATE). Nessun GRANT DELETE.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounting_budget_lines TO authenticated;

GRANT ALL ON TABLE public.accounting_budgets TO service_role;
GRANT ALL ON TABLE public.accounting_budget_lines TO service_role;

-- -----------------------------------------------------------------------------
-- 4) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_budget_lines ENABLE ROW LEVEL SECURITY;

-- --- budgets SELECT ---
DROP POLICY IF EXISTS accounting_budgets_select ON public.accounting_budgets;
CREATE POLICY accounting_budgets_select ON public.accounting_budgets
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- --- budgets INSERT (create) ---
DROP POLICY IF EXISTS accounting_budgets_insert ON public.accounting_budgets;
CREATE POLICY accounting_budgets_insert ON public.accounting_budgets
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
    )
    AND status = 'draft'
  );

-- --- budgets UPDATE draft (name/notes; status resta draft) ---
DROP POLICY IF EXISTS accounting_budgets_update_draft ON public.accounting_budgets;
CREATE POLICY accounting_budgets_update_draft ON public.accounting_budgets
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    )
    AND status = 'draft'
  )
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    )
    AND status = 'draft'
  );

-- --- budgets APPROVE (draft → approved); approved_* forzati dal trigger ---
DROP POLICY IF EXISTS accounting_budgets_approve ON public.accounting_budgets;
CREATE POLICY accounting_budgets_approve ON public.accounting_budgets
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    )
    AND status = 'draft'
  )
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    )
    AND status = 'approved'
    AND approved_at IS NOT NULL
    AND approved_by IS NOT NULL
  );

-- --- budgets ARCHIVE (approved → archived) ---
DROP POLICY IF EXISTS accounting_budgets_archive ON public.accounting_budgets;
CREATE POLICY accounting_budgets_archive ON public.accounting_budgets
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    )
    AND status = 'approved'
  )
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    )
    AND status = 'archived'
  );

-- Nessuna policy DELETE su budgets.

-- --- lines SELECT ---
DROP POLICY IF EXISTS accounting_budget_lines_select ON public.accounting_budget_lines;
CREATE POLICY accounting_budget_lines_select ON public.accounting_budget_lines
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- --- lines INSERT (solo budget draft) ---
DROP POLICY IF EXISTS accounting_budget_lines_insert ON public.accounting_budget_lines;
CREATE POLICY accounting_budget_lines_insert ON public.accounting_budget_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
      OR public.has_accounting_permission('accounting.create')
    )
    AND source_type = 'manual'
    AND EXISTS (
      SELECT 1
      FROM public.accounting_budgets b
      WHERE b.id = budget_id
        AND b.status = 'draft'
    )
  );

-- --- lines UPDATE (solo budget draft) ---
DROP POLICY IF EXISTS accounting_budget_lines_update ON public.accounting_budget_lines;
CREATE POLICY accounting_budget_lines_update ON public.accounting_budget_lines
  FOR UPDATE TO authenticated
  USING (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    )
    AND source_type = 'manual'
    AND EXISTS (
      SELECT 1
      FROM public.accounting_budgets b
      WHERE b.id = budget_id
        AND b.status = 'draft'
    )
  )
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    )
    AND source_type = 'manual'
    AND EXISTS (
      SELECT 1
      FROM public.accounting_budgets b
      WHERE b.id = budget_id
        AND b.status = 'draft'
    )
  );

-- --- lines DELETE (solo budget draft) ---
DROP POLICY IF EXISTS accounting_budget_lines_delete ON public.accounting_budget_lines;
CREATE POLICY accounting_budget_lines_delete ON public.accounting_budget_lines
  FOR DELETE TO authenticated
  USING (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.edit_draft')
    )
    AND source_type = 'manual'
    AND EXISTS (
      SELECT 1
      FROM public.accounting_budgets b
      WHERE b.id = budget_id
        AND b.status = 'draft'
    )
  );

COMMIT;
