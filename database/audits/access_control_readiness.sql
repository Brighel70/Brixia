-- =============================================================================
-- Access-control readiness audit (sola lettura)
-- =============================================================================
-- Esegui in Supabase SQL Editor prima di introdurre RLS sulle tabelle operative.
-- Non modifica dati, policy, grant o funzioni.

SELECT 'A1_profiles_without_person' AS check_id, id, email, role
FROM public.profiles
WHERE person_id IS NULL
ORDER BY created_at;

SELECT 'A2_multiple_profiles_for_person' AS check_id, person_id, count(*) AS profiles_count
FROM public.profiles
WHERE person_id IS NOT NULL
GROUP BY person_id
HAVING count(*) > 1;

SELECT 'B1_unknown_profile_role' AS check_id, pr.id, pr.email, pr.role
FROM public.profiles pr
LEFT JOIN public.user_roles ur ON ur.id = pr.user_role_id
WHERE pr.user_role_id IS NOT NULL AND ur.id IS NULL;

SELECT 'C1_teamflow_access_without_code' AS check_id, id, email, teamflow_app_role
FROM public.people
WHERE COALESCE(teamflow_access_blocked, false) = false
  AND teamflow_app_role IS NOT NULL
  AND NULLIF(btrim(invite_code_teamflow), '') IS NULL;

SELECT 'C2_flowme_access_without_code' AS check_id, id, email, app_role
FROM public.people
WHERE COALESCE(flowme_access_blocked, false) = false
  AND app_role IS NOT NULL
  AND NULLIF(btrim(invite_code), '') IS NULL;

SELECT
  'D1_operational_tables' AS check_id,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  count(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'people', 'categories', 'attendance', 'training_sessions', 'activities',
    'events', 'injuries', 'fees', 'fee_assignments', 'payments',
    'documents', 'tutor_athlete_relations', 'player_guardian_relationships'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

SELECT
  'E1_operational_policies' AS check_id,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'people', 'categories', 'attendance', 'training_sessions', 'activities',
    'events', 'injuries', 'fees', 'fee_assignments', 'payments',
    'documents', 'tutor_athlete_relations', 'player_guardian_relationships'
  )
ORDER BY tablename, policyname;
