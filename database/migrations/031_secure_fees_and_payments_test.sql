-- =============================================================================
-- Verifica successiva alla migration 031.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES ('fees'::text), ('fee_assignments'::text), ('payments'::text)
)
SELECT
  'T1_secure_fees_and_payments' AS check_id,
  bool_and(class.relrowsecurity) AS all_rls_active,
  bool_and(NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grant_info
    WHERE grant_info.table_schema = 'public'
      AND grant_info.table_name = watched_tables.tablename
      AND grant_info.grantee IN ('anon', 'PUBLIC')
  )) AS nothing_public,
  bool_and((
    SELECT count(*)
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = watched_tables.tablename
  ) = 4) AS policies_complete,
  3 = (
    SELECT count(DISTINCT procedure.proname)
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN ('can_manage_fees', 'can_view_fee', 'can_view_payment')
  ) AS access_helpers_present
FROM watched_tables
JOIN pg_class class
  ON class.oid = ('public.' || watched_tables.tablename)::regclass;
