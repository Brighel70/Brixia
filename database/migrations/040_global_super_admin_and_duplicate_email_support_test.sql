-- =============================================================================
-- Verifica 040 - Super Admin globale e liste gara
-- =============================================================================

WITH checks AS (
  SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_super_admin'
  ) AS super_admin_column_present,
  to_regprocedure('public.is_super_admin()') IS NOT NULL AS super_admin_helper_present,
  to_regprocedure('public.protect_super_admin_flag()') IS NOT NULL AS super_admin_guard_present,
  EXISTS (
    SELECT 1
    FROM public.profiles profile
    JOIN auth.users auth_user ON auth_user.id = profile.id
    WHERE lower(trim(auth_user.email)) = 'andreabulgari@me.com'
      AND profile.is_super_admin IS TRUE
  ) AS super_admin_account_enabled,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_lists' AND column_name = 'created_by_profile_id'
  ) AS match_lists_profile_audit_present,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'match_lists'
      AND policyname = 'match_lists_insert_authorized'
  ) AS match_list_policy_present
)
SELECT
  'T1_global_super_admin_setup' AS check_id,
  *,
  (
    super_admin_column_present
    AND super_admin_helper_present
    AND super_admin_guard_present
    AND super_admin_account_enabled
    AND match_lists_profile_audit_present
    AND match_list_policy_present
  ) AS all_checks_passed
FROM checks;
