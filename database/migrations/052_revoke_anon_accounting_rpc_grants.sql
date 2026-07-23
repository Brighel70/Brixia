-- =============================================================================
-- 052 - Hardening grants: nessun EXECUTE Contabilità per anon
--
-- Post-deploy 048→051 ha segnalato anon_rpc_grants = 1.
-- Revoca esplicita su tutte le RPC introdotte nelle fasi 048-051 + re-grant
-- solo a authenticated / service_role dove previsto.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'accounting_reconciliation%'
        OR p.proname LIKE 'accounting_fiscal_year%'
        OR p.proname LIKE 'accounting_fiscal_profile%'
        OR p.proname LIKE 'accounting_deadline%'
        OR p.proname IN (
          'accounting_set_approval_mode',
          'accounting_verify_manual_movement',
          'accounting_post_manual_movement',
          'accounting_movement_approval_mode',
          'accounting_recon_managed_net_cents',
          'accounting_fiscal_years_protect_status',
          'accounting_movements_require_writable_fy',
          'accounting_fiscal_year_build_snapshots'
        )
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      r.schema_name, r.function_name, r.args
    );
  END LOOP;
END;
$$;

-- Re-grant pubblici (client autenticato)
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'accounting_reconciliation_session_create(uuid, uuid, date, date, bigint, bigint, text)',
    'accounting_reconciliation_line_add(uuid, date, bigint, text, text, text)',
    'accounting_reconciliation_line_import_csv(uuid, text)',
    'accounting_reconciliation_line_match(uuid, uuid)',
    'accounting_reconciliation_line_unmatch(uuid)',
    'accounting_reconciliation_line_exclude(uuid, text)',
    'accounting_reconciliation_session_summary(uuid)',
    'accounting_reconciliation_session_complete(uuid)',
    'accounting_reconciliation_session_cancel(uuid, text)',
    'accounting_fiscal_year_closing_checklist(uuid)',
    'accounting_fiscal_year_open(uuid)',
    'accounting_fiscal_year_start_closing(uuid)',
    'accounting_fiscal_year_close(uuid)',
    'accounting_fiscal_year_reopen(uuid, text)',
    'accounting_fiscal_profile_get()',
    'accounting_fiscal_profile_update(jsonb, text)',
    'accounting_deadline_create(text, date, text, uuid, uuid, date, text)',
    'accounting_deadline_set_status(uuid, text, text)',
    'accounting_set_approval_mode(text, text)',
    'accounting_verify_manual_movement(uuid, text)',
    'accounting_post_manual_movement(uuid, text)'
  ]
  LOOP
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE '052 skip missing function: %', r;
    END;
  END LOOP;
END;
$$;

-- Interni: solo service_role
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'accounting_recon_managed_net_cents(uuid, date, date)',
    'accounting_movement_approval_mode()',
    'accounting_fiscal_year_build_snapshots(uuid)'
  ]
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', r);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE '052 skip missing internal: %', r;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON public.accounting_audit_log_readable FROM PUBLIC, anon;
GRANT SELECT ON public.accounting_audit_log_readable TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
