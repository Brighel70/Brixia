-- =============================================================================
-- Audit finale in sola lettura: relazioni, categorie e file Storage.
-- Non modifica dati, RLS, policy o permessi.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES
    ('categories'::text),
    ('player_guardian_relationships'::text),
    ('tutor_athlete_relations'::text),
    ('player_categories'::text),
    ('staff_categories'::text)
),
table_state AS (
  SELECT
    watched.tablename,
    to_regclass(format('public.%I', watched.tablename)) IS NOT NULL AS table_exists,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', policy.policyname,
        'command', policy.cmd,
        'roles', policy.roles,
        'using', policy.qual,
        'check', policy.with_check
      ) ORDER BY policy.policyname)
      FROM pg_policies policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = watched.tablename
    ), '[]'::jsonb) AS policies,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', column_info.column_name,
        'type', column_info.data_type,
        'nullable', column_info.is_nullable
      ) ORDER BY column_info.ordinal_position)
      FROM information_schema.columns column_info
      WHERE column_info.table_schema = 'public'
        AND column_info.table_name = watched.tablename
    ), '[]'::jsonb) AS columns
  FROM watched_tables watched
  LEFT JOIN pg_class class
    ON class.relname = watched.tablename
   AND class.relnamespace = 'public'::regnamespace
),
storage_state AS (
  SELECT jsonb_build_object(
    'buckets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', bucket.id,
        'name', bucket.name,
        'public', bucket.public
      ) ORDER BY bucket.id)
      FROM storage.buckets bucket
      WHERE bucket.id IN ('docs', 'injury-docs')
    ), '[]'::jsonb),
    'object_policies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', policy.policyname,
        'command', policy.cmd,
        'roles', policy.roles,
        'using', policy.qual,
        'check', policy.with_check
      ) ORDER BY policy.policyname)
      FROM pg_policies policy
      WHERE policy.schemaname = 'storage'
        AND policy.tablename = 'objects'
    ), '[]'::jsonb)
  ) AS audit
)
SELECT
  'T5_remaining_access_surfaces_readiness' AS check_id,
  jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_state.tablename,
        'exists', table_state.table_exists,
        'rls_active', table_state.rls_active,
        'columns', table_state.columns,
        'policies', table_state.policies
      ) ORDER BY table_state.tablename)
      FROM table_state
    ),
    'storage', (SELECT audit FROM storage_state)
  ) AS audit;
