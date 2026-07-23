-- =============================================================================
-- Allenamenti, presenze ed eventi: lettura tecnica prima della fase RLS.
-- NON modifica dati, policy, permessi o funzioni.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES ('sessions'::text), ('attendance'::text), ('events'::text)
),
table_state AS (
  SELECT
    watched.tablename,
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
)
SELECT
  'T3_operational_activity_rls_readiness' AS check_id,
  jsonb_agg(
    jsonb_build_object(
      'table', table_state.tablename,
      'rls_active', table_state.rls_active,
      'columns', table_state.columns,
      'policies', table_state.policies
    )
    ORDER BY table_state.tablename
  ) AS tables
FROM table_state;
