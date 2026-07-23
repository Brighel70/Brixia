-- Verifica post-apply della migration 046. Sola lettura.
WITH checks AS (
  SELECT
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%^events/%'
         AND pg_get_functiondef(procedure.oid) ILIKE '%events.view%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_view_docs_storage_object'
      LIMIT 1
    ), false) AS docs_view_allows_events_paths,
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%^events/%'
         AND pg_get_functiondef(procedure.oid) ILIKE '%events.edit%'
         AND pg_get_functiondef(procedure.oid) ILIKE '%people/%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_manage_docs_storage_object'
      LIMIT 1
    ), false) AS docs_manage_allows_events_and_people
)
SELECT
  'T1_allow_events_docs_storage' AS check_id,
  *,
  (
    docs_view_allows_events_paths
    AND docs_manage_allows_events_and_people
  ) AS all_passed
FROM checks;
