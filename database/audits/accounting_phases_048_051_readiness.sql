-- =============================================================================
-- Readiness Contabilità — fasi 048→051 (sola lettura)
-- Eseguire in Supabase SQL Editor PRIMA di applicare le nuove migration.
-- =============================================================================

SELECT jsonb_build_object(
  'check_id', 'accounting_phases_readiness',
  'fiscal_years_statuses', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'n', n) ORDER BY status), '[]'::jsonb)
    FROM (
      SELECT status, count(*)::int AS n
      FROM public.accounting_fiscal_years
      GROUP BY status
    ) s
  ),
  'has_accounting_settings', EXISTS (SELECT 1 FROM public.accounting_settings),
  'has_audit_log', to_regclass('public.accounting_audit_log') IS NOT NULL,
  'has_audit_write', EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'accounting_audit_write'
  ),
  'lifecycle_rpcs', (
    SELECT COALESCE(jsonb_object_agg(fname, exists), '{}'::jsonb)
    FROM (
      SELECT fname, EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = fname
      ) AS exists
      FROM (VALUES
        ('accounting_post_manual_movement'),
        ('accounting_cancel_manual_movement'),
        ('accounting_reverse_manual_movement'),
        ('accounting_fiscal_year_open'),
        ('accounting_reconciliation_session_create')
      ) AS v(fname)
    ) x
  ),
  'reconciliation_tables_absent', (
    to_regclass('public.accounting_reconciliation_sessions') IS NULL
    AND to_regclass('public.accounting_bank_statement_lines') IS NULL
  ),
  'movements_have_verified_at', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_movements'
      AND column_name = 'verified_at'
  ),
  'close_period_permission', EXISTS (
    SELECT 1 FROM public.permissions WHERE key = 'accounting.close_period'
  ),
  'audit_view_permission', EXISTS (
    SELECT 1 FROM public.permissions WHERE key = 'accounting.audit_view'
  ),
  'next_migration_hint', '048_accounting_bank_reconciliation.sql'
) AS readiness;
