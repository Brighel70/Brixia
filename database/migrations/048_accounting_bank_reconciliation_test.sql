-- =============================================================================
-- 048 - Verifica riconciliazione banca/cassa
-- Da eseguire DOPO 048_accounting_bank_reconciliation.sql
-- =============================================================================

WITH required_functions(function_name) AS (
  VALUES
    ('accounting_reconciliation_session_create'),
    ('accounting_reconciliation_line_add'),
    ('accounting_reconciliation_line_import_csv'),
    ('accounting_reconciliation_line_match'),
    ('accounting_reconciliation_line_unmatch'),
    ('accounting_reconciliation_line_exclude'),
    ('accounting_reconciliation_session_summary'),
    ('accounting_reconciliation_session_complete'),
    ('accounting_reconciliation_session_cancel'),
    ('accounting_recon_managed_net_cents')
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
    AND routine_name LIKE 'accounting_reconciliation%'
)
SELECT jsonb_build_object(
  'check_id', 'T1_accounting_bank_reconciliation',
  'all_functions_present', (SELECT bool_and(function_exists) FROM function_audit),
  'sessions_table', to_regclass('public.accounting_reconciliation_sessions') IS NOT NULL,
  'lines_table', to_regclass('public.accounting_bank_statement_lines') IS NOT NULL,
  'anon_execute_grants', (SELECT n FROM anon_exec),
  'rls_enabled_sessions', (
    SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'accounting_reconciliation_sessions'
  ),
  'rls_enabled_lines', (
    SELECT relrowsecurity FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'accounting_bank_statement_lines'
  ),
  'all_checks_passed',
    (SELECT bool_and(function_exists) FROM function_audit)
    AND to_regclass('public.accounting_reconciliation_sessions') IS NOT NULL
    AND to_regclass('public.accounting_bank_statement_lines') IS NOT NULL
    AND (SELECT n FROM anon_exec) = 0
) AS audit;
