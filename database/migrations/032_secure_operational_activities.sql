-- =============================================================================
-- 032_secure_operational_activities.sql
-- Recuperata dallo stato applicato in Supabase il 21/07/2026.
-- Eventi, sessioni e presenze sono perimetrati per categoria e ruolo.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.has_club_wide_operational_scope()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_app_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles profile
      LEFT JOIN public.user_roles assigned_role ON assigned_role.id = profile.user_role_id
      WHERE profile.id = auth.uid()
        AND lower(trim(coalesce(assigned_role.name, profile.role, ''))) IN (
          'dirigente', 'segreteria', 'direttore sportivo', 'medico', 'fisioterapista'
        )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_activity_category(p_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_club_wide_operational_scope()
    OR (p_category_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.people myself
        WHERE myself.id = public.get_my_person_id()
          AND (
            coalesce(myself.staff_categories, '[]'::jsonb) ? p_category_id::text
            OR coalesce(myself.teamflow_staff_categories, '[]'::jsonb) ? p_category_id::text
            OR coalesce(myself.player_categories, '[]'::jsonb) ? p_category_id::text
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.tutor_athlete_relations relation
        JOIN public.people athlete ON athlete.id = relation.athlete_id
        WHERE relation.tutor_id = public.get_my_person_id()
          AND coalesce(athlete.player_categories, '[]'::jsonb) ? p_category_id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.player_guardian_relationships relation
        JOIN public.people player ON player.id = relation.player_person_id
        WHERE relation.guardian_person_id = public.get_my_person_id()
          AND coalesce(player.player_categories, '[]'::jsonb) ? p_category_id::text
      )
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_activity_category(p_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff() AND (
    public.has_club_wide_operational_scope()
    OR (p_category_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.people myself
      WHERE myself.id = public.get_my_person_id()
        AND (
          coalesce(myself.staff_categories, '[]'::jsonb) ? p_category_id::text
          OR coalesce(myself.teamflow_staff_categories, '[]'::jsonb) ? p_category_id::text
        )
    ))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_attendance_record(p_session_id uuid, p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_app_permission('attendance.view') AND (
    p_player_id = public.get_my_person_id()
    OR EXISTS (SELECT 1 FROM public.players legacy_player WHERE legacy_player.id = p_player_id AND legacy_player.person_id = public.get_my_person_id())
    OR EXISTS (SELECT 1 FROM public.tutor_athlete_relations relation WHERE relation.tutor_id = public.get_my_person_id() AND relation.athlete_id = p_player_id)
    OR EXISTS (SELECT 1 FROM public.tutor_athlete_relations relation JOIN public.players legacy_player ON legacy_player.person_id = relation.athlete_id WHERE relation.tutor_id = public.get_my_person_id() AND legacy_player.id = p_player_id)
    OR EXISTS (SELECT 1 FROM public.player_guardian_relationships relation WHERE relation.guardian_person_id = public.get_my_person_id() AND relation.player_person_id = p_player_id)
    OR EXISTS (SELECT 1 FROM public.player_guardian_relationships relation JOIN public.players legacy_player ON legacy_player.person_id = relation.player_person_id WHERE relation.guardian_person_id = public.get_my_person_id() AND legacy_player.id = p_player_id)
    OR EXISTS (SELECT 1 FROM public.sessions session WHERE session.id = p_session_id AND public.is_operational_staff() AND public.can_access_activity_category(session.category_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_mark_attendance_for_session(p_session_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff()
    AND (public.has_app_permission('attendance.mark') OR public.has_app_permission('attendance.edit'))
    AND EXISTS (
      SELECT 1 FROM public.sessions session
      WHERE session.id = p_session_id AND public.can_manage_activity_category(session.category_id)
    );
$$;

REVOKE ALL ON FUNCTION public.has_club_wide_operational_scope() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_activity_category(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_activity_category(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_attendance_record(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_mark_attendance_for_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_club_wide_operational_scope() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_activity_category(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_activity_category(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_attendance_record(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_mark_attendance_for_session(uuid) TO authenticated, service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'events');
SELECT public._drop_all_policies('public', 'sessions');
SELECT public._drop_all_policies('public', 'attendance');

CREATE POLICY events_select_authorized ON public.events FOR SELECT TO authenticated
  USING (public.has_app_permission('events.view') AND (category_id IS NULL OR public.can_access_activity_category(category_id)));
CREATE POLICY events_insert_authorized ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.has_app_permission('events.create') AND public.can_manage_activity_category(category_id));
CREATE POLICY events_update_authorized ON public.events FOR UPDATE TO authenticated
  USING (public.has_app_permission('events.edit') AND public.can_manage_activity_category(category_id))
  WITH CHECK (public.has_app_permission('events.edit') AND public.can_manage_activity_category(category_id));
CREATE POLICY events_delete_authorized ON public.events FOR DELETE TO authenticated
  USING (public.has_app_permission('events.delete') AND public.can_manage_activity_category(category_id));

CREATE POLICY sessions_select_authorized ON public.sessions FOR SELECT TO authenticated
  USING (public.has_app_permission('sessions.view') AND public.can_access_activity_category(category_id));
CREATE POLICY sessions_insert_authorized ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (public.has_app_permission('sessions.create') AND public.can_manage_activity_category(category_id));
CREATE POLICY sessions_update_authorized ON public.sessions FOR UPDATE TO authenticated
  USING (public.has_app_permission('sessions.edit') AND public.can_manage_activity_category(category_id))
  WITH CHECK (public.has_app_permission('sessions.edit') AND public.can_manage_activity_category(category_id));
CREATE POLICY sessions_delete_authorized ON public.sessions FOR DELETE TO authenticated
  USING (public.has_app_permission('sessions.delete') AND public.can_manage_activity_category(category_id));

CREATE POLICY attendance_select_authorized ON public.attendance FOR SELECT TO authenticated
  USING (public.can_view_attendance_record(session_id, player_id));
CREATE POLICY attendance_insert_staff_authorized ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.can_mark_attendance_for_session(session_id));
CREATE POLICY attendance_insert_own_qr_authorized ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (
    player_id = public.get_my_person_id() AND status = 'PRESENTE'::status_enum
    AND EXISTS (SELECT 1 FROM public.people player WHERE player.id = attendance.player_id AND coalesce(player.is_player, false))
    AND EXISTS (SELECT 1 FROM public.sessions session WHERE session.id = attendance.session_id AND session.qr_active IS TRUE AND session.session_date = current_date AND public.can_access_activity_category(session.category_id))
  );
CREATE POLICY attendance_update_staff_authorized ON public.attendance FOR UPDATE TO authenticated
  USING (public.can_mark_attendance_for_session(session_id)) WITH CHECK (public.can_mark_attendance_for_session(session_id));
CREATE POLICY attendance_delete_staff_authorized ON public.attendance FOR DELETE TO authenticated
  USING (public.can_mark_attendance_for_session(session_id));

REVOKE ALL ON TABLE public.events, public.sessions, public.attendance FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events, public.sessions, public.attendance TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;


