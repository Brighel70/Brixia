-- Verifica post-apply della migration 039. Sola lettura.
WITH checks AS (
  SELECT
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%public.player_categories%'
         AND pg_get_functiondef(procedure.oid) ILIKE '%public.staff_categories%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_view_person'
      LIMIT 1
    ), false) AS person_scope_supports_legacy_memberships,
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%WHERE document.file_path = p_object_name%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_manage_docs_storage_object'
      LIMIT 1
    ), false) AS docs_legacy_paths_preserved,
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%p_user_id IS NOT NULL OR p_person_id IS NOT NULL%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_create_notification'
      LIMIT 1
    ), false) AS notifications_require_recipient,
    NOT has_table_privilege('authenticated', 'public.user_roles', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.user_roles', 'DELETE')
      AS user_role_writes_rpc_only
)
SELECT
  'T1_reconcile_legacy_memberships_and_internal_writes' AS check_id,
  *,
  (
    person_scope_supports_legacy_memberships
    AND docs_legacy_paths_preserved
    AND notifications_require_recipient
    AND user_role_writes_rpc_only
  ) AS all_checks_passed
FROM checks;

