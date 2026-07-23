-- =============================================================================
-- 049 - Verifica chiusura/riapertura esercizio
-- Da eseguire DOPO 049_accounting_fiscal_year_lifecycle.sql
-- =============================================================================

WITH required_functions(function_name) AS (
  VALUES
    ('accounting_fiscal_year_open'),
    ('accounting_fiscal_year_start_closing'),
    ('accounting_fiscal_year_close'),
    ('accounting_fiscal_year_reopen'),
    ('accounting_fiscal_year_closing_checklist'),
    ('accounting_fiscal_year_build_snapshots'),
    ('accounting_fiscal_years_protect_status'),
    ('accounting_movements_require_writable_fy')
),
function_audit AS (
  SELECT
    required.function_name,
    EXISTS (
      SELECT 1
      FROM pg_proc proc
      JOIN pg_namespace ns ON ns.oid = proc.pronamespace
      WHERE ns.nspname = 'public'
        AND proc.proname = required.function_name
    ) AS function_exists
  FROM required_functions required
),
anon_exec AS (
  SELECT count(*)::int AS n
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND grantee = 'anon'
    AND privilege_type = 'EXECUTE'
    AND routine_name LIKE 'accounting_fiscal_year%'
)
SELECT jsonb_build_object(
  'check_id', 'T1_accounting_fiscal_year_lifecycle',
  'all_functions_present', (SELECT bool_and(function_exists) FROM function_audit),
  'snapshots_table', to_regclass('public.accounting_fiscal_year_snapshots') IS NOT NULL,
  'status_protect_trigger', EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_accounting_fiscal_years_protect_status'
  ),
  'movements_fy_trigger', EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_accounting_movements_require_writable_fy'
  ),
  'fee_finder_open_only', EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accounting_fee_find_fiscal_year'
      AND pg_get_functiondef(p.oid) LIKE '%status = ''open''%'
  ),
  'anon_execute_grants', (SELECT n FROM anon_exec),
  'all_checks_passed',
    (SELECT bool_and(function_exists) FROM function_audit)
    AND to_regclass('public.accounting_fiscal_year_snapshots') IS NOT NULL
    AND (SELECT n FROM anon_exec) = 0
) AS audit;
