-- Controllo post-applicazione della migration 033. Non modifica nulla.

WITH watched_tables(tablename) AS (
  VALUES
    ('documents'::text),
    ('injuries'::text),
    ('injury_activities'::text),
    ('injury_documents'::text),
    ('injury_reminders'::text),
    ('injury_activity_types'::text),
    ('injury_document_types'::text),
    ('injury_document_type_assignees'::text),
    ('injury_email_templates'::text),
    ('injury_email_template_document_types'::text)
),
table_checks AS (
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
  FROM watched_tables watched
  LEFT JOIN pg_class class
    ON class.relname = watched.tablename
   AND class.relnamespace = 'public'::regnamespace
)
SELECT
  'T1_secure_documents_and_health' AS check_id,
  bool_and(rls_active) AS all_rls_active,
  bool_and(public_policy_count = 0) AS no_public_policies,
  bool_and(policy_count = 4) AS policies_complete,
  to_regprocedure('public.can_view_document(uuid)') IS NOT NULL
    AND to_regprocedure('public.can_manage_document(uuid)') IS NOT NULL
    AND to_regprocedure('public.can_view_injury(uuid)') IS NOT NULL
    AND to_regprocedure('public.can_manage_injury(uuid)') IS NOT NULL
    AND to_regprocedure('public.can_manage_health_settings()') IS NOT NULL
    AS access_helpers_present
FROM table_checks;
