-- =============================================================================
-- 051 - Verifica audit view + approvazioni
-- Da eseguire DOPO 051_accounting_audit_view_and_approvals.sql
-- =============================================================================

WITH required_functions(function_name) AS (
  VALUES
    ('accounting_set_approval_mode'),
    ('accounting_verify_manual_movement'),
    ('accounting_post_manual_movement'),
    ('accounting_movement_approval_mode')
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
    AND routine_name IN (
      'accounting_set_approval_mode',
      'accounting_verify_manual_movement',
      'accounting_post_manual_movement'
    )
)
SELECT jsonb_build_object(
  'check_id', 'T1_accounting_audit_approvals',
  'all_functions_present', (SELECT bool_and(function_exists) FROM function_audit),
  'approval_mode_column', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_settings'
      AND column_name = 'movement_approval_mode'
  ),
  'verification_note_column', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_movements'
      AND column_name = 'verification_note'
  ),
  'readable_view', to_regclass('public.accounting_audit_log_readable') IS NOT NULL,
  'default_mode_simple', EXISTS (
    SELECT 1 FROM public.accounting_settings
    WHERE singleton_guard = true AND movement_approval_mode = 'simple'
  ),
  'post_rpc_has_override_arg', EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accounting_post_manual_movement'
      AND pg_get_function_identity_arguments(p.oid) LIKE '%override%'
  ),
  'anon_execute_grants', (SELECT n FROM anon_exec),
  'all_checks_passed',
    (SELECT bool_and(function_exists) FROM function_audit)
    AND to_regclass('public.accounting_audit_log_readable') IS NOT NULL
    AND (SELECT n FROM anon_exec) = 0
) AS audit;
