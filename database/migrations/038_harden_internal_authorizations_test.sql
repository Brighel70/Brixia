-- Verifica post-apply della migration 038. Sola lettura.
WITH checks AS (
  SELECT
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'people'
        AND policyname = 'people_update_authorized'
        AND qual ILIKE '%can_view_person%'
        AND with_check ILIKE '%can_view_person%'
    ) AS people_update_scoped,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'people'
        AND policyname = 'people_delete_authorized'
        AND qual ILIKE '%can_view_person%'
    ) AS people_delete_scoped,
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%^people/%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_manage_docs_storage_object'
      LIMIT 1
    ), false) AS docs_upload_path_scoped,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notifications'
        AND policyname = 'notifications_insert_authorized'
        AND with_check ILIKE '%can_create_notification%'
    ) AS notifications_insert_scoped,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'notifications'
        AND policyname = 'notifications_insert_authenticated'
    ) AS notifications_legacy_insert_removed,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'permissions'
        AND policyname = 'permissions_select_authenticated'
    ) AS permissions_catalog_readable,
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'role_permissions'
        AND policyname = 'role_permissions_select_authenticated'
    ) AS role_permissions_catalog_readable,
    NOT has_table_privilege('authenticated', 'public.user_permissions', 'INSERT')
      AND NOT has_table_privilege('authenticated', 'public.user_permissions', 'UPDATE')
      AND NOT has_table_privilege('authenticated', 'public.user_permissions', 'DELETE')
      AS user_permission_writes_rpc_only,
    COALESCE((
      SELECT pg_get_functiondef(procedure.oid) ILIKE '%has_club_wide_operational_scope%'
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_view_person'
      LIMIT 1
    ), false) AS person_scope_category_aware
)
SELECT
  'T1_harden_internal_authorizations' AS check_id,
  *,
  (
    people_update_scoped
    AND people_delete_scoped
    AND docs_upload_path_scoped
    AND notifications_insert_scoped
    AND notifications_legacy_insert_removed
    AND permissions_catalog_readable
    AND role_permissions_catalog_readable
    AND user_permission_writes_rpc_only
    AND person_scope_category_aware
  ) AS all_checks_passed
FROM checks;

