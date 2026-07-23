-- =============================================================================
-- 033_secure_documents_and_health.sql
-- Recuperata dallo stato applicato in Supabase il 21/07/2026.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_health_person(p_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff()
    AND public.has_app_permission('health.manage')
    AND public.can_view_person(p_person_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_document(p_document_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_app_permission('documents.view')
    AND EXISTS (
      SELECT 1 FROM public.documents document
      WHERE document.id = p_document_id AND (
        (document.person_id IS NOT NULL AND public.can_view_person(document.person_id))
        OR (document.person_id IS NULL AND public.is_operational_staff() AND public.has_club_wide_operational_scope())
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_document(p_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff() AND public.has_app_permission('documents.manage')
    AND ((p_person_id IS NOT NULL AND public.can_view_person(p_person_id))
      OR (p_person_id IS NULL AND public.has_club_wide_operational_scope()));
$$;

CREATE OR REPLACE FUNCTION public.can_view_injury(p_injury_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND public.is_operational_staff()
    AND public.has_app_permission('health.view')
    AND EXISTS (SELECT 1 FROM public.injuries injury WHERE injury.id = p_injury_id AND public.can_view_person(injury.person_id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_injury(p_injury_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff() AND public.has_app_permission('health.manage')
    AND EXISTS (SELECT 1 FROM public.injuries injury WHERE injury.id = p_injury_id AND public.can_view_person(injury.person_id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_health_settings()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff() AND public.has_app_permission('health.manage')
    AND public.has_club_wide_operational_scope();
$$;

REVOKE ALL ON FUNCTION public.can_manage_health_person(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_document(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_injury(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_injury(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_health_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_health_person(uuid), public.can_view_document(uuid),
  public.can_manage_document(uuid), public.can_view_injury(uuid), public.can_manage_injury(uuid),
  public.can_manage_health_settings() TO authenticated, service_role;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_document_type_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_email_template_document_types ENABLE ROW LEVEL SECURITY;

SELECT public._drop_all_policies('public', 'documents');
SELECT public._drop_all_policies('public', 'injuries');
SELECT public._drop_all_policies('public', 'injury_activities');
SELECT public._drop_all_policies('public', 'injury_documents');
SELECT public._drop_all_policies('public', 'injury_reminders');
SELECT public._drop_all_policies('public', 'injury_activity_types');
SELECT public._drop_all_policies('public', 'injury_document_types');
SELECT public._drop_all_policies('public', 'injury_document_type_assignees');
SELECT public._drop_all_policies('public', 'injury_email_templates');
SELECT public._drop_all_policies('public', 'injury_email_template_document_types');

CREATE POLICY documents_select_authorized ON public.documents FOR SELECT TO authenticated USING (public.can_view_document(id));
CREATE POLICY documents_insert_authorized ON public.documents FOR INSERT TO authenticated WITH CHECK (public.can_manage_document(person_id));
CREATE POLICY documents_update_authorized ON public.documents FOR UPDATE TO authenticated USING (public.can_manage_document(person_id)) WITH CHECK (public.can_manage_document(person_id));
CREATE POLICY documents_delete_authorized ON public.documents FOR DELETE TO authenticated USING (public.can_manage_document(person_id));

CREATE POLICY injuries_select_authorized ON public.injuries FOR SELECT TO authenticated USING (public.can_view_injury(id));
CREATE POLICY injuries_insert_authorized ON public.injuries FOR INSERT TO authenticated WITH CHECK (public.can_manage_health_person(person_id));
CREATE POLICY injuries_update_authorized ON public.injuries FOR UPDATE TO authenticated USING (public.can_manage_injury(id)) WITH CHECK (public.can_manage_health_person(person_id));
CREATE POLICY injuries_delete_authorized ON public.injuries FOR DELETE TO authenticated USING (public.can_manage_injury(id));

CREATE POLICY injury_activities_select_authorized ON public.injury_activities FOR SELECT TO authenticated USING (public.can_view_injury(injury_id));
CREATE POLICY injury_activities_insert_authorized ON public.injury_activities FOR INSERT TO authenticated WITH CHECK (public.can_manage_injury(injury_id));
CREATE POLICY injury_activities_update_authorized ON public.injury_activities FOR UPDATE TO authenticated USING (public.can_manage_injury(injury_id)) WITH CHECK (public.can_manage_injury(injury_id));
CREATE POLICY injury_activities_delete_authorized ON public.injury_activities FOR DELETE TO authenticated USING (public.can_manage_injury(injury_id));
CREATE POLICY injury_documents_select_authorized ON public.injury_documents FOR SELECT TO authenticated USING (public.can_view_injury(injury_id));
CREATE POLICY injury_documents_insert_authorized ON public.injury_documents FOR INSERT TO authenticated WITH CHECK (public.can_manage_injury(injury_id));
CREATE POLICY injury_documents_update_authorized ON public.injury_documents FOR UPDATE TO authenticated USING (public.can_manage_injury(injury_id)) WITH CHECK (public.can_manage_injury(injury_id));
CREATE POLICY injury_documents_delete_authorized ON public.injury_documents FOR DELETE TO authenticated USING (public.can_manage_injury(injury_id));
CREATE POLICY injury_reminders_select_authorized ON public.injury_reminders FOR SELECT TO authenticated USING (public.can_view_injury(injury_id));
CREATE POLICY injury_reminders_insert_authorized ON public.injury_reminders FOR INSERT TO authenticated WITH CHECK (public.can_manage_injury(injury_id));
CREATE POLICY injury_reminders_update_authorized ON public.injury_reminders FOR UPDATE TO authenticated USING (public.can_manage_injury(injury_id)) WITH CHECK (public.can_manage_injury(injury_id));
CREATE POLICY injury_reminders_delete_authorized ON public.injury_reminders FOR DELETE TO authenticated USING (public.can_manage_injury(injury_id));

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'injury_activity_types', 'injury_document_types', 'injury_document_type_assignees',
    'injury_email_templates', 'injury_email_template_document_types'
  ] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_app_permission(''health.view''))', table_name || '_select_authorized', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage_health_settings())', table_name || '_insert_authorized', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_manage_health_settings()) WITH CHECK (public.can_manage_health_settings())', table_name || '_update_authorized', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_manage_health_settings())', table_name || '_delete_authorized', table_name);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.documents, public.injuries, public.injury_activities,
  public.injury_documents, public.injury_reminders, public.injury_activity_types,
  public.injury_document_types, public.injury_document_type_assignees,
  public.injury_email_templates, public.injury_email_template_document_types FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents, public.injuries,
  public.injury_activities, public.injury_documents, public.injury_reminders,
  public.injury_activity_types, public.injury_document_types, public.injury_document_type_assignees,
  public.injury_email_templates, public.injury_email_template_document_types TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;


