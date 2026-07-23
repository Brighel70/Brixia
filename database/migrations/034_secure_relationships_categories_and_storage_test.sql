-- Controllo post-applicazione della migration 034. Non modifica nulla.

WITH watched_tables(tablename) AS (
  VALUES
    ('categories'::text),
    ('player_categories'::text),
    ('staff_categories'::text),
    ('player_guardian_relationships'::text),
    ('tutor_athlete_relations'::text)
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
),
storage_checks AS (
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM pg_policies policy
      WHERE policy.schemaname = 'storage'
        AND policy.tablename = 'objects'
        AND policy.policyname IN (
          'Authenticated can delete docs',
          'Authenticated can read docs',
          'Authenticated can update docs',
          'Authenticated can upload docs',
          'Authenticated delete injury-docs',
          'Authenticated insert injury-docs',
          'Authenticated read injury-docs',
          'Authenticated update injury-docs'
        )
    ) AS generic_storage_policies_removed,
    (
      SELECT count(*) = 4
      FROM pg_policies policy
      WHERE policy.schemaname = 'storage'
        AND policy.tablename = 'objects'
        AND policy.policyname LIKE 'storage_docs_%'
    ) AS docs_policies_complete,
    (
      SELECT count(*) = 4
      FROM pg_policies policy
      WHERE policy.schemaname = 'storage'
        AND policy.tablename = 'objects'
        AND policy.policyname LIKE 'storage_injury_docs_%'
    ) AS injury_docs_policies_complete,
    NOT EXISTS (
      SELECT 1
      FROM storage.buckets bucket
      WHERE bucket.id IN ('docs', 'injury-docs')
        AND bucket.public IS TRUE
    ) AS document_buckets_private
)
SELECT
  'T1_secure_relationships_categories_and_storage' AS check_id,
  bool_and(rls_active) AS all_rls_active,
  bool_and(public_policy_count = 0) AS no_public_table_policies,
  bool_and(policy_count = 4) AS table_policies_complete,
  (SELECT generic_storage_policies_removed FROM storage_checks) AS generic_storage_policies_removed,
  (SELECT docs_policies_complete FROM storage_checks) AS docs_storage_policies_complete,
  (SELECT injury_docs_policies_complete FROM storage_checks) AS injury_docs_storage_policies_complete,
  (SELECT document_buckets_private FROM storage_checks) AS document_buckets_private,
  to_regprocedure('public.can_view_docs_storage_object(text)') IS NOT NULL
    AND to_regprocedure('public.can_manage_injury_storage_object(text)') IS NOT NULL
    AS access_helpers_present
FROM table_checks;
