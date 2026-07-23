-- =============================================================================
-- Verifica tecnica in sola lettura dei punti emersi dalla revisione indipendente.
-- Non modifica dati, ruoli, policy o file nello Storage.
-- =============================================================================

WITH monitored_tables AS (
  SELECT unnest(ARRAY[
    'people', 'documents', 'injury_documents', 'notifications', 'permissions',
    'user_permissions', 'user_roles', 'role_permissions', 'brand_settings'
  ]) AS table_name
), table_state AS (
  SELECT
    monitored.table_name,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    jsonb_build_object(
      'anon_select', COALESCE(has_table_privilege('anon', format('public.%I', monitored.table_name), 'SELECT'), false),
      'authenticated_select', COALESCE(has_table_privilege('authenticated', format('public.%I', monitored.table_name), 'SELECT'), false),
      'authenticated_insert', COALESCE(has_table_privilege('authenticated', format('public.%I', monitored.table_name), 'INSERT'), false),
      'authenticated_update', COALESCE(has_table_privilege('authenticated', format('public.%I', monitored.table_name), 'UPDATE'), false),
      'authenticated_delete', COALESCE(has_table_privilege('authenticated', format('public.%I', monitored.table_name), 'DELETE'), false)
    ) AS privileges,
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
        AND policy.tablename = monitored.table_name
    ), '[]'::jsonb) AS policies
  FROM monitored_tables monitored
  LEFT JOIN pg_class class ON class.relname = monitored.table_name
  LEFT JOIN pg_namespace namespace ON namespace.oid = class.relnamespace AND namespace.nspname = 'public'
)
SELECT
  'T10_cursor_review_critical_points' AS check_id,
  jsonb_build_object(
    'tables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'table', table_name,
        'rls_active', rls_active,
        'privileges', privileges,
        'policies', policies
      ) ORDER BY table_name)
      FROM table_state
    ), '[]'::jsonb),
    'can_view_person_live_definition', (
      SELECT pg_get_functiondef(procedure.oid)
      FROM pg_proc procedure
      JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = 'public'
        AND procedure.proname = 'can_view_person'
        AND pg_get_function_identity_arguments(procedure.oid) = 'p_person_id uuid'
      LIMIT 1
    ),
    'storage_policies', COALESCE((
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
        AND (policy.qual ILIKE '%docs%' OR policy.with_check ILIKE '%docs%')
    ), '[]'::jsonb),
    'notification_columns', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', column_name,
        'type', data_type,
        'nullable', is_nullable
      ) ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications'
    ), '[]'::jsonb),
    'brand_setting_value_health', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', setting.key,
        'value_type', pg_typeof(setting.value)::text,
        'is_empty', COALESCE(btrim(setting.value::text), '') = '',
        'looks_like_json', CASE
          WHEN COALESCE(btrim(setting.value::text), '') = '' THEN false
          WHEN setting.value::text ~ '^\\s*[\\{\\[]' THEN true
          ELSE false
        END
      ) ORDER BY setting.key)
      FROM public.brand_settings setting
    ), '[]'::jsonb)
  ) AS audit;

