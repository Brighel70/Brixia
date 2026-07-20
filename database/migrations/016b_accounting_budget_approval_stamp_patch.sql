-- =============================================================================
-- 016b_accounting_budget_approval_stamp_patch.sql
-- =============================================================================
-- Patch post-016 parziale: aggiunge SOLO lo stamp di approvazione
-- (approved_at / approved_by forzati da auth.uid()).
--
-- Usare se la verifica mostra:
--   budgets_exists = true
--   budget_lines_exists = true
--   quote_trigger_exists = true
--   approval_trigger_exists = false
--
-- NON ricrea tabelle. NON tocca Quote/FlowMe.
-- Rieseguibile (DROP IF EXISTS + CREATE OR REPLACE).
-- =============================================================================

BEGIN;

-- Allinea CHECK: approved richiede approved_at E approved_by
ALTER TABLE public.accounting_budgets
  DROP CONSTRAINT IF EXISTS accounting_budgets_approved_fields;

ALTER TABLE public.accounting_budgets
  ADD CONSTRAINT accounting_budgets_approved_fields
  CHECK (
    (status = 'draft' AND approved_at IS NULL AND approved_by IS NULL)
    OR (status = 'approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL)
    OR (status = 'archived')
  );

COMMENT ON COLUMN public.accounting_budgets.approved_by IS
  'Impostato solo dal trigger accounting_budget_stamp_approval da auth.uid(); '
  'il client non può scegliere un altro profilo.';

CREATE OR REPLACE FUNCTION public.accounting_budget_stamp_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
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

-- Policy approve: richiede anche approved_by (valorizzato dal trigger)
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

COMMIT;

-- Verifica post-patch
SELECT
  to_regclass('public.accounting_budgets') IS NOT NULL AS budgets_exists,
  to_regclass('public.accounting_budget_lines') IS NOT NULL AS budget_lines_exists,
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'accounting_budget_lines'
      AND t.tgname = 'trg_accounting_budget_forbid_quote_category'
      AND NOT t.tgisinternal
  ) AS quote_trigger_exists,
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'accounting_budgets'
      AND t.tgname = 'trg_accounting_budgets_stamp_approval'
      AND NOT t.tgisinternal
  ) AS approval_trigger_exists;
