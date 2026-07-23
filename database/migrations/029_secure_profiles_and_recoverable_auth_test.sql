-- =============================================================================
-- Verifica successiva alla migration 029.
-- =============================================================================

SELECT
  'T1_secure_profiles_and_recoverable_auth' AS check_id,
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.profiles'::regclass) AS profiles_rls_active,
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants grant_info
    WHERE grant_info.table_schema = 'public'
      AND grant_info.table_name = 'profiles'
      AND grant_info.grantee IN ('anon', 'PUBLIC')
  ) AS profiles_not_public,
  NOT EXISTS (
    SELECT 1
    FROM auth.users auth_user
    LEFT JOIN public.profiles profile ON profile.id = auth_user.id
    WHERE profile.id IS NULL
      AND auth_user.email IS NOT NULL
      AND (
        SELECT count(*)
        FROM public.people person
        WHERE lower(trim(coalesce(person.email, ''))) = lower(trim(auth_user.email))
          AND person.status = 'active'
      ) = 1
  ) AS recoverable_auth_linked,
  (SELECT count(*)
   FROM auth.users auth_user
   LEFT JOIN public.profiles profile ON profile.id = auth_user.id
   WHERE profile.id IS NULL) AS auth_without_profile_remaining;
