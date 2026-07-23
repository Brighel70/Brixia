-- =============================================================================
-- Audit in sola lettura per la prossima fase RLS.
-- Analizza liste gara, statistiche, note, archivio giocatori, sedi di
-- allenamento, tutori e visite. Non modifica dati, policy o permessi.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES
    ('match_lists'::text),
    ('match_statistics'::text),
    ('notes'::text),
    ('players'::text),
    ('guardians'::text),
    ('tutors'::text),
    ('training_locations'::text),
    ('visit_day_schedules'::text),
    ('visit_list_entries'::text)
),
table_details AS (
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
        'column', key_column.column_name,
        'references_table', foreign_table.table_name,
        'references_column', foreign_column.column_name
      ) ORDER BY key_column.column_name)
      FROM information_schema.table_constraints constraint_info
      JOIN information_schema.key_column_usage key_column
        ON key_column.constraint_name = constraint_info.constraint_name
       AND key_column.table_schema = constraint_info.table_schema
      JOIN information_schema.constraint_column_usage foreign_column
        ON foreign_column.constraint_name = constraint_info.constraint_name
       AND foreign_column.table_schema = constraint_info.table_schema
      JOIN information_schema.tables foreign_table
        ON foreign_table.table_schema = foreign_column.table_schema
       AND foreign_table.table_name = foreign_column.table_name
      WHERE constraint_info.table_schema = 'public'
        AND constraint_info.table_name = watched.tablename
        AND constraint_info.constraint_type = 'FOREIGN KEY'
    ), '[]'::jsonb) AS foreign_keys
  FROM watched_tables watched
  LEFT JOIN pg_class class
    ON class.relname = watched.tablename
   AND class.relnamespace = 'public'::regnamespace
),
helper_functions AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', procedure.proname,
    'identity_arguments', pg_get_function_identity_arguments(procedure.oid),
    'definition', pg_get_functiondef(procedure.oid)
  ) ORDER BY procedure.proname), '[]'::jsonb) AS functions
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND (
      procedure.proname ILIKE '%category%'
      OR procedure.proname IN (
        'can_view_event', 'can_manage_event', 'can_view_session', 'can_manage_session',
        'can_view_person', 'is_operational_staff', 'get_my_person_id'
      )
    )
),
data_health AS (
  SELECT jsonb_build_object(
    'players_total', (SELECT count(*) FROM public.players),
    'players_without_person_id', (SELECT count(*) FROM public.players WHERE person_id IS NULL),
    'match_lists_total', (SELECT count(*) FROM public.match_lists),
    'match_lists_without_category', (SELECT count(*) FROM public.match_lists WHERE category_id IS NULL),
    'match_lists_without_event', (SELECT count(*) FROM public.match_lists WHERE event_id IS NULL),
    'match_statistics_total', (SELECT count(*) FROM public.match_statistics),
    'match_statistics_without_list', (SELECT count(*) FROM public.match_statistics WHERE match_list_id IS NULL),
    'notes_total', (SELECT count(*) FROM public.notes),
    'notes_without_person', (SELECT count(*) FROM public.notes WHERE person_id IS NULL),
    'training_locations_total', (SELECT count(*) FROM public.training_locations),
    'training_locations_without_category', (SELECT count(*) FROM public.training_locations WHERE category_id IS NULL),
    'visit_entries_total', (SELECT count(*) FROM public.visit_list_entries),
    'visit_entries_without_player', (SELECT count(*) FROM public.visit_list_entries WHERE player_id IS NULL),
    'visit_entries_with_unlinked_player', (
      SELECT count(*)
      FROM public.visit_list_entries entry
      LEFT JOIN public.players player ON player.id = entry.player_id
      WHERE player.person_id IS NULL
    )
  ) AS checks
)
SELECT
  'T8_sensitive_operational_access_readiness' AS check_id,
  (SELECT jsonb_agg(jsonb_build_object(
    'table', detail.tablename,
    'rls_active', detail.rls_active,
    'foreign_keys', detail.foreign_keys,
    'policies', detail.policies
  ) ORDER BY detail.tablename) FROM table_details detail) AS tables,
  (SELECT functions FROM helper_functions) AS category_and_scope_helpers,
  (SELECT checks FROM data_health) AS data_health;
