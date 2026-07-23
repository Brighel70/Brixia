-- 041_accounting_system_category_admin_controls_test.sql
-- Verifica strutturale non distruttiva della migration 041.

WITH function_checks AS (
  SELECT
    'accounting_category_enforce_group_coherence' AS function_name,
    pg_get_functiondef('public.accounting_category_enforce_group_coherence()'::regprocedure) AS definition
  UNION ALL
  SELECT
    'accounting_categories_integrity_guard',
    pg_get_functiondef('public.accounting_categories_integrity_guard()'::regprocedure)
  UNION ALL
  SELECT
    'accounting_category_group_update',
    pg_get_functiondef('public.accounting_category_group_update(uuid,text,text,integer,boolean,boolean)'::regprocedure)
  UNION ALL
  SELECT
    'accounting_category_update',
    pg_get_functiondef('public.accounting_category_update(uuid,text,text,text,boolean,boolean,boolean,boolean,integer,boolean,uuid,boolean)'::regprocedure)
)
SELECT
  'T1_admin_system_category_controls' AS check_id,
  bool_and(definition ILIKE '%is_app_admin()%') AS all_functions_scope_admin,
  bool_and(definition ILIKE '%SECURITY DEFINER%') FILTER (
    WHERE function_name IN ('accounting_category_group_update', 'accounting_category_update')
  ) AS write_rpcs_remain_security_definer,
  bool_and(definition ILIKE '%code immutabile%' OR function_name NOT IN ('accounting_category_enforce_group_coherence')) AS system_code_remains_protected,
  bool_and(definition ILIKE '%non archiviabile%' OR function_name NOT IN ('accounting_categories_integrity_guard')) AS technical_archive_remains_protected
FROM function_checks;
