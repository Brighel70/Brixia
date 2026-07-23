-- =============================================================================
-- Verifica successiva alla migration 030.
-- =============================================================================

SELECT
  'T1_secure_people_access' AS check_id,
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.people'::regclass) AS people_rls_active,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grant_info
    WHERE grant_info.table_schema = 'public'
      AND grant_info.table_name = 'people'
      AND grant_info.grantee IN ('anon', 'PUBLIC')
  ) AS people_not_public,
  (SELECT count(*)
   FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'people') = 4 AS people_policies_complete,
  EXISTS (
    SELECT 1
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'can_view_person'
  ) AS relationship_guard_present;
