-- =============================================================================
-- 050 - Verifica profilo fiscale + calendario
-- Da eseguire DOPO 050_accounting_fiscal_profile_and_calendar.sql
-- =============================================================================

WITH required_functions(function_name) AS (
  VALUES
    ('accounting_fiscal_profile_get'),
    ('accounting_fiscal_profile_update'),
    ('accounting_deadline_create'),
    ('accounting_deadline_set_status')
),
function_audit AS (
  SELECT
    required.function_name,
    EXISTS (
      SELECT 1 FROM pg_proc proc
      JOIN pg_namespace ns ON ns.oid = proc.pronamespace
      WHERE ns.nspname = 'public' AND proc.proname = required.function_name
    ) AS function_exists
  FROM required_functions required
),
anon_exec AS (
  SELECT count(*)::int AS n
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND grantee = 'anon'
    AND privilege_type = 'EXECUTE'
    AND (
      routine_name LIKE 'accounting_fiscal_profile%'
      OR routine_name LIKE 'accounting_deadline%'
    )
)
SELECT jsonb_build_object(
  'check_id', 'T1_accounting_fiscal_profile_calendar',
  'all_functions_present', (SELECT bool_and(function_exists) FROM function_audit),
  'settings_new_columns', (
    SELECT count(*)::int FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_settings'
      AND column_name IN (
        'commercial_activity_active', 'ets_flag', 'fiscal_profile_notes', 'future_modules'
      )
  ) = 4,
  'deadlines_table', to_regclass('public.accounting_operational_deadlines') IS NOT NULL,
  'profile_snapshots_table', to_regclass('public.accounting_fiscal_profile_snapshots') IS NOT NULL,
  'filing_always_false_constraint', EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_operational_deadlines_no_auto_filing'
  ),
  'anon_execute_grants', (SELECT n FROM anon_exec),
  'all_checks_passed',
    (SELECT bool_and(function_exists) FROM function_audit)
    AND to_regclass('public.accounting_operational_deadlines') IS NOT NULL
    AND (SELECT n FROM anon_exec) = 0
) AS audit;
