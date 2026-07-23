-- =============================================================================
-- 029_secure_profiles_and_recoverable_auth.sql
--
-- Prima protezione effettiva della fase RLS:
-- - collega gli account Auth che corrispondono senza ambiguita a una persona attiva;
-- - rende privata la tabella profiles;
-- - lascia gli account demo senza persona senza accesso operativo.
--
-- Non elimina utenti Auth o persone.
-- =============================================================================

BEGIN;

-- Recupera solo gli account per cui email -> una sola persona attiva e' certo.
WITH recoverable_auth AS (
  SELECT
    auth_user.id AS auth_user_id,
    auth_user.email,
    person.id AS person_id,
    person.given_name,
    person.family_name,
    person.full_name,
    person.app_role,
    person.teamflow_app_role
  FROM auth.users auth_user
  LEFT JOIN public.profiles profile ON profile.id = auth_user.id
  JOIN public.people person
    ON lower(trim(coalesce(person.email, ''))) = lower(trim(coalesce(auth_user.email, '')))
   AND person.status = 'active'
  WHERE profile.id IS NULL
    AND auth_user.email IS NOT NULL
    AND (
      SELECT count(*)
      FROM public.people matching_person
      WHERE lower(trim(coalesce(matching_person.email, ''))) = lower(trim(auth_user.email))
        AND matching_person.status = 'active'
    ) = 1
),
resolved_roles AS (
  SELECT
    candidate.*,
    COALESCE(teamflow_role.name, flowme_role.name, 'Famiglia') AS profile_role
  FROM recoverable_auth candidate
  LEFT JOIN LATERAL (
    SELECT user_role.name
    FROM public.user_roles user_role
    WHERE user_role.id::text = candidate.teamflow_app_role
       OR lower(trim(user_role.name)) = lower(trim(coalesce(candidate.teamflow_app_role, '')))
    ORDER BY (user_role.id::text = candidate.teamflow_app_role) DESC
    LIMIT 1
  ) teamflow_role ON true
  LEFT JOIN LATERAL (
    SELECT user_role.name
    FROM public.user_roles user_role
    WHERE user_role.id::text = candidate.app_role
       OR lower(trim(user_role.name)) = lower(trim(coalesce(candidate.app_role, '')))
    ORDER BY (user_role.id::text = candidate.app_role) DESC
    LIMIT 1
  ) flowme_role ON true
)
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  full_name,
  role,
  person_id
)
SELECT
  auth_user_id,
  email,
  COALESCE(given_name, ''),
  COALESCE(family_name, ''),
  COALESCE(full_name, NULLIF(trim(concat_ws(' ', given_name, family_name)), ''), email),
  profile_role,
  person_id
FROM resolved_roles
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_user_view ON public.profiles;
CREATE POLICY profiles_select_own_or_user_view
  ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_app_permission('users.view')
  );

DROP POLICY IF EXISTS profiles_insert_user_create ON public.profiles;
CREATE POLICY profiles_insert_user_create
  ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_app_permission('users.create'));

DROP POLICY IF EXISTS profiles_update_user_edit ON public.profiles;
CREATE POLICY profiles_update_user_edit
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('users.edit'))
  WITH CHECK (public.has_app_permission('users.edit'));

DROP POLICY IF EXISTS profiles_delete_user_delete ON public.profiles;
CREATE POLICY profiles_delete_user_delete
  ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_app_permission('users.delete'));

REVOKE ALL ON TABLE public.profiles FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
