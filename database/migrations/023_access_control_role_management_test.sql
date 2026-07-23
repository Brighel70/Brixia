-- Verifiche post-apply per 023. Solo lettura/metadati.

SELECT 'T1_functions_security_definer' AS check_id, p.proname, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('has_app_permission', 'admin_replace_role_permissions', 'admin_set_user_permission')
ORDER BY p.proname;

SELECT 'T2_authenticated_permission_table_grants' AS check_id, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('role_permissions', 'user_permissions')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso: soltanto SELECT per entrambe le tabelle.

SELECT
  'T3_manage_permissions_seeded' AS check_id,
  EXISTS (SELECT 1 FROM public.permissions WHERE name = 'users.manage_permissions') AS permission_exists,
  EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.id = rp.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.name ILIKE 'Admin' AND p.name = 'users.manage_permissions'
  ) AS admin_has_permission;
