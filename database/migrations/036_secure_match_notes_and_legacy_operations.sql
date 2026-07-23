-- =============================================================================
-- 036_secure_match_notes_and_legacy_operations.sql
-- Recuperata dallo stato applicato in Supabase il 21/07/2026.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_match_list(p_match_list_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_app_permission('events.view') AND EXISTS (
    SELECT 1 FROM public.match_lists match_list
    WHERE match_list.id = p_match_list_id AND public.can_access_activity_category(match_list.category_id)
  );
$$;
CREATE OR REPLACE FUNCTION public.can_manage_match_list(p_match_list_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.is_operational_staff() AND public.has_app_permission('events.edit') AND EXISTS (
    SELECT 1 FROM public.match_lists match_list
    WHERE match_list.id = p_match_list_id AND public.can_manage_activity_category(match_list.category_id)
  );
$$;
CREATE OR REPLACE FUNCTION public.can_view_internal_note(p_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.is_operational_staff() AND public.can_view_person(p_person_id)
    AND (public.has_app_permission('players.view') OR public.has_app_permission('staff.view') OR public.has_app_permission('fees.view'));
$$;
REVOKE ALL ON FUNCTION public.can_view_match_list(uuid), public.can_manage_match_list(uuid), public.can_view_internal_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_match_list(uuid), public.can_manage_match_list(uuid), public.can_view_internal_note(uuid) TO authenticated, service_role;

ALTER TABLE public.match_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_day_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_list_entries ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'match_lists');
SELECT public._drop_all_policies('public', 'match_statistics');
SELECT public._drop_all_policies('public', 'notes');
SELECT public._drop_all_policies('public', 'players');
SELECT public._drop_all_policies('public', 'guardians');
SELECT public._drop_all_policies('public', 'tutors');
SELECT public._drop_all_policies('public', 'training_locations');
SELECT public._drop_all_policies('public', 'visit_day_schedules');
SELECT public._drop_all_policies('public', 'visit_list_entries');

CREATE POLICY match_lists_select_authorized ON public.match_lists FOR SELECT TO authenticated USING (public.has_app_permission('events.view') AND public.can_access_activity_category(category_id));
CREATE POLICY match_lists_insert_authorized ON public.match_lists FOR INSERT TO authenticated WITH CHECK (public.is_operational_staff() AND public.has_app_permission('events.edit') AND public.can_manage_activity_category(category_id) AND created_by = public.get_my_person_id());
CREATE POLICY match_lists_update_authorized ON public.match_lists FOR UPDATE TO authenticated USING (public.can_manage_match_list(id)) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('events.edit') AND public.can_manage_activity_category(category_id));
CREATE POLICY match_lists_delete_authorized ON public.match_lists FOR DELETE TO authenticated USING (public.can_manage_match_list(id));
CREATE POLICY match_statistics_select_authorized ON public.match_statistics FOR SELECT TO authenticated USING (public.can_view_match_list(match_list_id));
CREATE POLICY match_statistics_insert_authorized ON public.match_statistics FOR INSERT TO authenticated WITH CHECK (public.can_manage_match_list(match_list_id) AND (player_id IS NULL OR public.can_view_person(player_id)));
CREATE POLICY match_statistics_update_authorized ON public.match_statistics FOR UPDATE TO authenticated USING (public.can_manage_match_list(match_list_id)) WITH CHECK (public.can_manage_match_list(match_list_id) AND (player_id IS NULL OR public.can_view_person(player_id)));
CREATE POLICY match_statistics_delete_authorized ON public.match_statistics FOR DELETE TO authenticated USING (public.can_manage_match_list(match_list_id));

CREATE POLICY notes_select_authorized ON public.notes FOR SELECT TO authenticated USING (public.can_view_internal_note(person_id));
CREATE POLICY notes_insert_authorized ON public.notes FOR INSERT TO authenticated WITH CHECK (public.can_view_internal_note(person_id) AND (public.has_app_permission('players.edit') OR public.has_app_permission('fees.manage')));
CREATE POLICY notes_update_authorized ON public.notes FOR UPDATE TO authenticated USING (public.can_view_internal_note(person_id) AND (public.has_app_permission('players.edit') OR public.has_app_permission('fees.manage'))) WITH CHECK (public.can_view_internal_note(person_id) AND (public.has_app_permission('players.edit') OR public.has_app_permission('fees.manage')));
CREATE POLICY notes_delete_authorized ON public.notes FOR DELETE TO authenticated USING (public.can_view_internal_note(person_id) AND (public.has_app_permission('players.edit') OR public.has_app_permission('fees.manage')));

CREATE POLICY players_select_authorized ON public.players FOR SELECT TO authenticated USING (public.has_app_permission('players.view') AND public.can_view_person(person_id));
CREATE POLICY players_insert_authorized ON public.players FOR INSERT TO authenticated WITH CHECK (public.is_operational_staff() AND public.has_app_permission('players.edit') AND public.can_view_person(person_id));
CREATE POLICY players_update_authorized ON public.players FOR UPDATE TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('players.edit') AND public.can_view_person(person_id)) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('players.edit') AND public.can_view_person(person_id));
CREATE POLICY players_delete_authorized ON public.players FOR DELETE TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('players.delete') AND public.can_view_person(person_id));
CREATE POLICY guardians_select_authorized ON public.guardians FOR SELECT TO authenticated USING (public.can_view_person(child_person_id) OR public.can_view_person(guardian_person_id));
CREATE POLICY guardians_write_authorized ON public.guardians FOR ALL TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('players.edit') AND public.can_view_person(child_person_id) AND public.can_view_person(guardian_person_id)) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('players.edit') AND public.can_view_person(child_person_id) AND public.can_view_person(guardian_person_id));
CREATE POLICY tutors_select_authorized ON public.tutors FOR SELECT TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('staff.view'));
CREATE POLICY tutors_write_authorized ON public.tutors FOR ALL TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('staff.edit')) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('staff.edit'));

CREATE POLICY training_locations_select_authorized ON public.training_locations FOR SELECT TO authenticated USING (public.has_app_permission('sessions.view') AND public.can_access_activity_category(category_id));
CREATE POLICY training_locations_insert_authorized ON public.training_locations FOR INSERT TO authenticated WITH CHECK (public.is_operational_staff() AND public.has_app_permission('sessions.edit') AND public.can_manage_activity_category(category_id));
CREATE POLICY training_locations_update_authorized ON public.training_locations FOR UPDATE TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('sessions.edit') AND public.can_manage_activity_category(category_id)) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('sessions.edit') AND public.can_manage_activity_category(category_id));
CREATE POLICY training_locations_delete_authorized ON public.training_locations FOR DELETE TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('sessions.edit') AND public.can_manage_activity_category(category_id));
CREATE POLICY visit_day_schedules_select_authorized ON public.visit_day_schedules FOR SELECT TO authenticated USING (public.has_app_permission('health.view'));
CREATE POLICY visit_day_schedules_write_authorized ON public.visit_day_schedules FOR ALL TO authenticated USING (public.has_app_permission('health.manage')) WITH CHECK (public.has_app_permission('health.manage'));
CREATE POLICY visit_list_entries_select_authorized ON public.visit_list_entries FOR SELECT TO authenticated USING (public.has_app_permission('health.view') AND public.can_view_person(player_id));
CREATE POLICY visit_list_entries_write_authorized ON public.visit_list_entries FOR ALL TO authenticated USING (public.has_app_permission('health.manage') AND public.can_view_person(player_id)) WITH CHECK (public.has_app_permission('health.manage') AND public.can_view_person(player_id));

REVOKE ALL ON TABLE public.match_lists, public.match_statistics, public.notes, public.players,
  public.guardians, public.tutors, public.training_locations, public.visit_day_schedules,
  public.visit_list_entries FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.match_lists, public.match_statistics,
  public.notes, public.players, public.guardians, public.tutors, public.training_locations,
  public.visit_day_schedules, public.visit_list_entries TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
