-- =============================================================================
-- Recupero documentale delle migration 032-034 gia' applicate in Supabase.
-- Il repository locale contiene file vuoti: questo audit estrae soltanto le
-- definizioni effettivamente presenti nel database per ricostruirli fedelmente.
-- Non modifica dati, policy, funzioni o bucket.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES
    ('events'::text), ('sessions'::text), ('attendance'::text),
    ('documents'::text), ('injuries'::text), ('injury_activities'::text),
    ('injury_documents'::text), ('injury_reminders'::text),
    ('injury_activity_types'::text), ('injury_document_types'::text),
    ('injury_document_type_assignees'::text), ('injury_email_templates'::text),
    ('injury_email_template_document_types'::text),
    ('categories'::text), ('player_categories'::text), ('staff_categories'::text),
    ('player_guardian_relationships'::text), ('tutor_athlete_relations'::text)
),
table_policies AS (
  SELECT jsonb_agg(jsonb_build_object(
    'table', watched.tablename,
    'rls_active', COALESCE(class.relrowsecurity, false),
    'policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', policy.policyname,
        'command', policy.cmd,
        'roles', policy.roles,
        'using', policy.qual,
        'check', policy.with_check
      ) ORDER BY policy.policyname)
      FROM pg_policies policy
      WHERE policy.schemaname = 'public' AND policy.tablename = watched.tablename
    ), '[]'::jsonb)
  ) ORDER BY watched.tablename) AS value
  FROM watched_tables watched
  LEFT JOIN pg_class class ON class.relname = watched.tablename
    AND class.relnamespace = 'public'::regnamespace
),
helpers AS (
  SELECT jsonb_agg(jsonb_build_object(
    'name', procedure.proname,
    'identity_arguments', pg_get_function_identity_arguments(procedure.oid),
    'definition', pg_get_functiondef(procedure.oid)
  ) ORDER BY procedure.proname, pg_get_function_identity_arguments(procedure.oid)) AS value
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname IN (
      'has_club_wide_operational_scope',
      'can_access_activity_category',
      'can_manage_activity_category',
      'can_view_attendance_record',
      'can_mark_attendance_for_session',
      'can_view_document',
      'can_manage_document',
      'can_view_injury',
      'can_manage_injury',
      'can_manage_health_settings',
      'can_view_docs_storage_object',
      'can_manage_injury_storage_object'
    )
),
storage_policies AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', policy.policyname,
    'command', policy.cmd,
    'roles', policy.roles,
    'using', policy.qual,
    'check', policy.with_check
  ) ORDER BY policy.policyname), '[]'::jsonb) AS value
  FROM pg_policies policy
  WHERE policy.schemaname = 'storage'
    AND policy.tablename = 'objects'
    AND (policy.policyname LIKE 'storage_docs_%' OR policy.policyname LIKE 'storage_injury_docs_%')
),
buckets AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', bucket.id,
    'public', bucket.public,
    'file_size_limit', bucket.file_size_limit,
    'allowed_mime_types', bucket.allowed_mime_types
  ) ORDER BY bucket.id), '[]'::jsonb) AS value
  FROM storage.buckets bucket
  WHERE bucket.id IN ('docs', 'injury-docs')
)
SELECT
  'T9_recover_applied_032_034' AS check_id,
  (SELECT value FROM table_policies) AS table_policies,
  (SELECT value FROM helpers) AS helper_definitions,
  (SELECT value FROM storage_policies) AS storage_policies,
  (SELECT value FROM buckets) AS buckets;
