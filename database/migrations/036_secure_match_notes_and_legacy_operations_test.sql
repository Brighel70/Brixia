-- Verifica post-esecuzione 036. Sola lettura.
WITH expected_tables(tablename) AS (
  VALUES
    ('match_lists'::text), ('match_statistics'::text), ('notes'::text),
    ('players'::text), ('guardians'::text), ('tutors'::text),
    ('training_locations'::text), ('visit_day_schedules'::text),
    ('visit_list_entries'::text)
), table_check AS (
  SELECT expected.tablename,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    COALESCE((SELECT bool_and(policy.roles = ARRAY['authenticated']::name[])
      FROM pg_policies policy
      WHERE policy.schemaname = 'public' AND policy.tablename = expected.tablename), false) AS policies_scoped
  FROM expected_tables expected
  LEFT JOIN pg_class class ON class.relname = expected.tablename AND class.relnamespace = 'public'::regnamespace
), helper_check AS (
  SELECT bool_and(to_regprocedure(signature) IS NOT NULL) AS helpers_present
  FROM (VALUES
    ('public.can_view_match_list(uuid)'::text),
    ('public.can_manage_match_list(uuid)'::text),
    ('public.can_view_internal_note(uuid)'::text),
    ('public.can_access_activity_category(uuid)'::text),
    ('public.can_manage_activity_category(uuid)'::text)
  ) AS expected(signature)
)
SELECT 'T1_secure_match_notes_and_legacy_operations' AS check_id,
  (SELECT bool_and(rls_active) FROM table_check) AS all_rls_active,
  (SELECT bool_and(policies_scoped) FROM table_check) AS policies_scoped,
  (SELECT helpers_present FROM helper_check) AS access_helpers_present,
  NOT EXISTS (
    SELECT 1 FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename IN (
        'match_lists', 'match_statistics', 'notes', 'players', 'guardians',
        'tutors', 'training_locations', 'visit_day_schedules', 'visit_list_entries'
      )
      AND policy.roles @> ARRAY['anon']::name[]
  ) AS no_anonymous_access;
