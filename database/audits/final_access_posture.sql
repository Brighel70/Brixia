-- =============================================================================
-- Audit finale in sola lettura dell'esposizione RLS nel database TeamFlow.
-- Non modifica dati, policy, ruoli o file.
--
-- Restituisce solamente le tabelle pubbliche che hanno almeno una condizione
-- da valutare: RLS spenta, policy per public/anon, oppure grant ad anon.
-- Le tabelle non elencate non hanno questi segnali di esposizione.
-- =============================================================================

WITH table_state AS (
  SELECT
    class.relname AS table_name,
    class.relrowsecurity AS rls_active,
    has_table_privilege('anon', format('public.%I', class.relname), 'SELECT') AS anon_can_select,
    has_table_privilege('anon', format('public.%I', class.relname), 'INSERT') AS anon_can_insert,
    has_table_privilege('anon', format('public.%I', class.relname), 'UPDATE') AS anon_can_update,
    has_table_privilege('anon', format('public.%I', class.relname), 'DELETE') AS anon_can_delete,
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
        AND policy.tablename = class.relname
        AND (
          policy.roles @> ARRAY['public']::name[]
          OR policy.roles @> ARRAY['anon']::name[]
        )
    ), '[]'::jsonb) AS public_or_anon_policies
  FROM pg_class class
  JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'public'
    AND class.relkind IN ('r', 'p')
),
exposed_tables AS (
  SELECT *
  FROM table_state
  WHERE NOT rls_active
     OR anon_can_select
     OR anon_can_insert
     OR anon_can_update
     OR anon_can_delete
     OR jsonb_array_length(public_or_anon_policies) > 0
)
SELECT
  'T6_final_access_posture' AS check_id,
  jsonb_build_object(
    'tables_to_review', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_name,
        'rls_active', rls_active,
        'anon_privileges', jsonb_build_object(
          'select', anon_can_select,
          'insert', anon_can_insert,
          'update', anon_can_update,
          'delete', anon_can_delete
        ),
        'public_or_anon_policies', public_or_anon_policies
      ) ORDER BY table_name)
      FROM exposed_tables
    ), '[]'::jsonb),
    'tables_to_review_count', (SELECT count(*) FROM exposed_tables),
    'core_tables_with_basic_exposure', COALESCE((
      SELECT jsonb_agg(table_name ORDER BY table_name)
      FROM exposed_tables
      WHERE table_name IN (
        'profiles', 'people', 'fees', 'fee_assignments', 'payments',
        'events', 'activities', 'sessions', 'attendance', 'documents', 'injuries',
        'player_guardian_relationships', 'tutor_athlete_relations'
      )
    ), '[]'::jsonb)
  ) AS audit;
