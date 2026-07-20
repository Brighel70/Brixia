-- =============================================================================
-- 011_accounting_foundation_hardening.sql
-- =============================================================================
-- STEP 2B — Hardening post-apply (minimo privilegio SQL)
--
-- Corregge privilegi residui tipici di Supabase default privileges dopo 010:
--   - authenticated: rimuove DELETE/TRUNCATE/REFERENCES/TRIGGER sulle 6 tabelle
--   - anon/PUBLIC: nessun privilegio sulle tabelle; nessun EXECUTE sulle funzioni
--
-- NON modifica: dati, policy RLS, Quote, FlowMe, altre tabelle.
-- NON crea: funzioni, trigger, tabelle.
-- Rieseguibile senza effetti duplicati.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Tabelle foundation — REVOKE ALL + GRANT minimo a authenticated
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounting_settings FROM anon;
REVOKE ALL ON TABLE public.accounting_fiscal_params FROM anon;
REVOKE ALL ON TABLE public.accounting_fiscal_years FROM anon;
REVOKE ALL ON TABLE public.accounting_accounts FROM anon;
REVOKE ALL ON TABLE public.accounting_categories FROM anon;
REVOKE ALL ON TABLE public.accounting_payment_method_account_map FROM anon;

REVOKE ALL ON TABLE public.accounting_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_fiscal_params FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_fiscal_years FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_accounts FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_categories FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_payment_method_account_map FROM PUBLIC;

REVOKE ALL ON TABLE public.accounting_settings FROM authenticated;
REVOKE ALL ON TABLE public.accounting_fiscal_params FROM authenticated;
REVOKE ALL ON TABLE public.accounting_fiscal_years FROM authenticated;
REVOKE ALL ON TABLE public.accounting_accounts FROM authenticated;
REVOKE ALL ON TABLE public.accounting_categories FROM authenticated;
REVOKE ALL ON TABLE public.accounting_payment_method_account_map FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_fiscal_params TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_fiscal_years TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_payment_method_account_map TO authenticated;

GRANT ALL ON TABLE public.accounting_settings TO service_role;
GRANT ALL ON TABLE public.accounting_fiscal_params TO service_role;
GRANT ALL ON TABLE public.accounting_fiscal_years TO service_role;
GRANT ALL ON TABLE public.accounting_accounts TO service_role;
GRANT ALL ON TABLE public.accounting_categories TO service_role;
GRANT ALL ON TABLE public.accounting_payment_method_account_map TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Funzioni Contabilità — nessun EXECUTE a anon/PUBLIC
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.has_accounting_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_accounting_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_accounting_permission(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_accounting_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accounting_permission(text) TO service_role;

REVOKE ALL ON FUNCTION public.accounting_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_set_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_set_updated_at() TO service_role;

COMMIT;
