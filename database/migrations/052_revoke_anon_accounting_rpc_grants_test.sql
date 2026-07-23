-- =============================================================================
-- 052 - Verifica: zero EXECUTE Contabilità per anon (fasi 048-051)
-- Da eseguire DOPO 052_revoke_anon_accounting_rpc_grants.sql
-- =============================================================================

WITH anon_grants AS (
  SELECT routine_name, privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND grantee = 'anon'
    AND privilege_type = 'EXECUTE'
    AND (
      routine_name LIKE 'accounting_reconciliation%'
      OR routine_name LIKE 'accounting_fiscal_year%'
      OR routine_name LIKE 'accounting_fiscal_profile%'
      OR routine_name LIKE 'accounting_deadline%'
      OR routine_name IN (
        'accounting_set_approval_mode',
        'accounting_verify_manual_movement',
        'accounting_post_manual_movement',
        'accounting_movement_approval_mode',
        'accounting_recon_managed_net_cents'
      )
    )
)
SELECT jsonb_build_object(
  'check_id', 'T1_revoke_anon_accounting_rpc',
  'anon_execute_count', (SELECT count(*)::int FROM anon_grants),
  'anon_execute_routines', COALESCE(
    (SELECT jsonb_agg(routine_name ORDER BY routine_name) FROM anon_grants),
    '[]'::jsonb
  ),
  'all_checks_passed', (SELECT count(*) FROM anon_grants) = 0
) AS audit;
