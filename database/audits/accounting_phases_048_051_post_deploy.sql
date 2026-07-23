-- =============================================================================
-- Verifica post-deploy fasi 048→051 (sola lettura)
-- Eseguire in Supabase SQL Editor dopo aver applicato 048, 049, 050, 051
-- =============================================================================

SELECT jsonb_build_object(
  'check_id', 'accounting_phases_048_051_post_deploy',
  'tables', jsonb_build_object(
    'reconciliation_sessions', to_regclass('public.accounting_reconciliation_sessions') IS NOT NULL,
    'bank_statement_lines', to_regclass('public.accounting_bank_statement_lines') IS NOT NULL,
    'fy_snapshots', to_regclass('public.accounting_fiscal_year_snapshots') IS NOT NULL,
    'deadlines', to_regclass('public.accounting_operational_deadlines') IS NOT NULL,
    'profile_snapshots', to_regclass('public.accounting_fiscal_profile_snapshots') IS NOT NULL,
    'audit_readable', to_regclass('public.accounting_audit_log_readable') IS NOT NULL
  ),
  'settings_columns', (
    SELECT COALESCE(jsonb_object_agg(column_name, true), '{}'::jsonb)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_settings'
      AND column_name IN (
        'commercial_activity_active',
        'ets_flag',
        'fiscal_profile_notes',
        'future_modules',
        'movement_approval_mode'
      )
  ),
  'default_approval_simple', EXISTS (
    SELECT 1 FROM public.accounting_settings
    WHERE singleton_guard AND movement_approval_mode = 'simple'
  ),
  'anon_rpc_grants', (
    SELECT count(*)::int
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
  ),
  'anon_rpc_names', (
    SELECT COALESCE(jsonb_agg(routine_name ORDER BY routine_name), '[]'::jsonb)
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
  ),
  'key_functions', (
    SELECT COALESCE(jsonb_object_agg(fname, present), '{}'::jsonb)
    FROM (
      SELECT fname, EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = fname
      ) AS present
      FROM (VALUES
        ('accounting_reconciliation_session_create'),
        ('accounting_fiscal_year_close'),
        ('accounting_fiscal_year_reopen'),
        ('accounting_fiscal_profile_get'),
        ('accounting_deadline_create'),
        ('accounting_verify_manual_movement'),
        ('accounting_set_approval_mode')
      ) v(fname)
    ) x
  )
) AS verification;
