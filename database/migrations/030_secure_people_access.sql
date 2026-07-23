-- =============================================================================
-- 030_secure_people_access.sql
--
-- Protegge le anagrafiche people:
-- - ogni persona vede se stessa;
-- - un tutore/familiare vede le persone effettivamente collegate;
-- - lo staff operativo vede le anagrafiche necessarie al proprio lavoro;
-- - le modifiche richiedono permessi operativi espliciti.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_operational_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.is_app_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profiles profile
      JOIN public.people person ON person.id = profile.person_id
      WHERE profile.id = auth.uid()
        AND COALESCE(person.is_staff, false)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_person(p_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      p_person_id = public.get_my_person_id()
      OR (
        public.is_operational_staff()
        AND (
          public.has_app_permission('players.view')
          OR public.has_app_permission('staff.view')
          OR public.has_app_permission('health.view')
          OR public.has_app_permission('fees.view')
          OR public.has_app_permission('documents.view')
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.tutor_athlete_relations relation
        WHERE relation.tutor_id = public.get_my_person_id()
          AND relation.athlete_id = p_person_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.player_guardian_relationships relation
        WHERE relation.guardian_person_id = public.get_my_person_id()
          AND relation.player_person_id = p_person_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.is_operational_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_operational_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_person(uuid) TO authenticated, service_role;

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'people');

CREATE POLICY people_select_authorized
  ON public.people
  FOR SELECT TO authenticated
  USING (public.can_view_person(id));

CREATE POLICY people_insert_authorized
  ON public.people
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_app_permission('players.create')
    OR public.has_app_permission('staff.create')
    OR public.has_app_permission('users.create')
  );

CREATE POLICY people_update_authorized
  ON public.people
  FOR UPDATE TO authenticated
  USING (
    public.has_app_permission('players.edit')
    OR public.has_app_permission('staff.edit')
    OR public.has_app_permission('users.edit')
  )
  WITH CHECK (
    public.has_app_permission('players.edit')
    OR public.has_app_permission('staff.edit')
    OR public.has_app_permission('users.edit')
  );

CREATE POLICY people_delete_authorized
  ON public.people
  FOR DELETE TO authenticated
  USING (
    public.has_app_permission('players.delete')
    OR public.has_app_permission('staff.delete')
    OR public.has_app_permission('users.delete')
  );

REVOKE ALL ON TABLE public.people FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.people TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
