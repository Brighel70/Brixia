-- =============================================================================
-- 022_accounting_category_integrity_test.sql
-- =============================================================================
-- Verifiche post-apply. Solo lettura/metadati: non scrive dati applicativi.
-- =============================================================================

SELECT 'T1_quote_single_active_system' AS check_id,
  COUNT(*) FILTER (WHERE upper(btrim(code)) = 'QUOTE') = 1
    AND bool_and(is_system AND is_active)
    AND bool_and(NOT available_in_movements AND NOT available_in_budget AND available_in_reports) AS ok
FROM public.accounting_categories
WHERE upper(btrim(code)) = 'QUOTE';

SELECT 'T2_sponsor_canonical' AS check_id,
  COUNT(*) FILTER (WHERE upper(btrim(code)) = 'SPONSOR') = 1 AS has_one_sponsor,
  COUNT(*) FILTER (WHERE upper(btrim(code)) = 'SPONSORIZZAZIONI' AND is_active) = 0 AS no_active_legacy
FROM public.accounting_categories;

SELECT 'T3_integrity_triggers' AS check_id,
  c.relname AS table_name,
  t.tgname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND t.tgname IN (
    'trg_accounting_categories_integrity_guard',
    'trg_accounting_categories_prevent_delete',
    'trg_accounting_category_groups_integrity_guard',
    'trg_accounting_category_groups_prevent_delete',
    'trg_accounting_manual_movement_category_guard',
    'trg_accounting_budget_line_category_guard'
  )
  AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT 'T4_authenticated_category_dml' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('accounting_category_groups', 'accounting_categories')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso: soltanto SELECT; creazione/modifica passa dalle RPC SECURITY DEFINER.

SELECT 'T5_security_definer' AS check_id,
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'accounting_category_group_create',
    'accounting_category_group_update',
    'accounting_category_create',
    'accounting_category_update',
    'accounting_commercial_preferred_income_category_id'
  )
ORDER BY p.proname;
