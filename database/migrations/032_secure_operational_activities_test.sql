-- Controllo post-applicazione della migration 032.
-- Non modifica dati o policy.

WITH table_checks AS (
  SELECT
    watched.tablename,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    (
      SELECT count(*)
      FROM pg_policies policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = watched.tablename
        AND policy.roles @> ARRAY['public']::name[]
    ) AS public_policy_count,
    (
      SELECT count(*)
      FROM pg_policies policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = watched.tablename
    ) AS policy_count
  FROM (VALUES
    ('events'::text),
    ('sessions'::text),
    ('attendance'::text)
  ) AS watched(tablename)
  LEFT JOIN pg_class class
    ON class.relname = watched.tablename
   AND class.relnamespace = 'public'::regnamespace
)
SELECT
  'T1_secure_operational_activities' AS check_id,
  bool_and(rls_active) AS all_rls_active,
  bool_and(public_policy_count = 0) AS no_public_policies,
  bool_and(
    (tablename = 'events' AND policy_count = 4)
    OR (tablename = 'sessions' AND policy_count = 4)
    OR (tablename = 'attendance' AND policy_count = 5)
  ) AS policies_complete,
  to_regprocedure('public.has_club_wide_operational_scope()') IS NOT NULL
    AND to_regprocedure('public.can_access_activity_category(uuid)') IS NOT NULL
    AND to_regprocedure('public.can_manage_activity_category(uuid)') IS NOT NULL
    AND to_regprocedure('public.can_view_attendance_record(uuid,uuid)') IS NOT NULL
    AND to_regprocedure('public.can_mark_attendance_for_session(uuid)') IS NOT NULL
    AS access_helpers_present
FROM table_checks;
