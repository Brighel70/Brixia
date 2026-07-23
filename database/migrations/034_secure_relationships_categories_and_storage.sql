-- =============================================================================
-- 034_secure_relationships_categories_and_storage.sql
-- Recuperata dallo stato applicato in Supabase il 21/07/2026.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_player_category_membership(p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT public.can_view_person(p_player_id); $$;

CREATE OR REPLACE FUNCTION public.can_manage_player_category_membership(p_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff()
    AND public.has_app_permission('players.edit')
    AND public.can_manage_activity_category(p_category_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_staff_category_membership(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_user_id = auth.uid() OR p_user_id = public.get_my_person_id()
    OR EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = p_user_id AND (
        profile.person_id = public.get_my_person_id()
        OR (public.is_operational_staff()
          AND (public.has_app_permission('staff.view') OR public.has_app_permission('players.view'))
          AND profile.person_id IS NOT NULL AND public.can_view_person(profile.person_id))
      )
    )
    OR (public.is_operational_staff()
      AND (public.has_app_permission('staff.view') OR public.has_app_permission('players.view'))
      AND public.can_view_person(p_user_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_staff_category_membership()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff()
    AND (public.has_app_permission('staff.edit') OR public.has_app_permission('users.edit'));
$$;

CREATE OR REPLACE FUNCTION public.can_view_family_relationship(p_guardian_id uuid, p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_guardian_id = public.get_my_person_id() OR p_player_id = public.get_my_person_id()
    OR (public.is_operational_staff() AND public.can_view_person(p_guardian_id) AND public.can_view_person(p_player_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_family_relationship(p_guardian_id uuid, p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff() AND public.has_app_permission('players.edit')
    AND public.can_view_person(p_guardian_id) AND public.can_view_person(p_player_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_tutor_relationship(p_tutor_id uuid, p_athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_tutor_id = public.get_my_person_id() OR p_athlete_id = public.get_my_person_id()
    OR (public.is_operational_staff() AND public.can_view_person(p_tutor_id) AND public.can_view_person(p_athlete_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_tutor_relationship(p_tutor_id uuid, p_athlete_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff() AND public.has_app_permission('players.edit')
    AND public.can_view_person(p_tutor_id) AND public.can_view_person(p_athlete_id);
$$;

CREATE OR REPLACE FUNCTION public.can_view_docs_storage_object(p_object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.documents document WHERE document.file_path = p_object_name AND public.can_view_document(document.id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_docs_storage_object(p_object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.documents document WHERE document.file_path = p_object_name AND public.can_manage_document(document.person_id));
$$;

CREATE OR REPLACE FUNCTION public.can_view_injury_storage_object(p_object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN p_object_name ~ '^[0-9a-fA-F-]{36}/'
    THEN public.can_view_injury((regexp_match(p_object_name, '^([0-9a-fA-F-]{36})/'))[1]::uuid)
    ELSE false END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_injury_storage_object(p_object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE WHEN p_object_name ~ '^[0-9a-fA-F-]{36}/'
    THEN public.can_manage_injury((regexp_match(p_object_name, '^([0-9a-fA-F-]{36})/'))[1]::uuid)
    ELSE false END;
$$;

REVOKE ALL ON FUNCTION public.can_view_player_category_membership(uuid),
  public.can_manage_player_category_membership(uuid), public.can_view_staff_category_membership(uuid),
  public.can_manage_staff_category_membership(), public.can_view_family_relationship(uuid, uuid),
  public.can_manage_family_relationship(uuid, uuid), public.can_view_tutor_relationship(uuid, uuid),
  public.can_manage_tutor_relationship(uuid, uuid), public.can_view_docs_storage_object(text),
  public.can_manage_docs_storage_object(text), public.can_view_injury_storage_object(text),
  public.can_manage_injury_storage_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_player_category_membership(uuid),
  public.can_manage_player_category_membership(uuid), public.can_view_staff_category_membership(uuid),
  public.can_manage_staff_category_membership(), public.can_view_family_relationship(uuid, uuid),
  public.can_manage_family_relationship(uuid, uuid), public.can_view_tutor_relationship(uuid, uuid),
  public.can_manage_tutor_relationship(uuid, uuid), public.can_view_docs_storage_object(text),
  public.can_manage_docs_storage_object(text), public.can_view_injury_storage_object(text),
  public.can_manage_injury_storage_object(text) TO authenticated, service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_guardian_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_athlete_relations ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'categories');
SELECT public._drop_all_policies('public', 'player_categories');
SELECT public._drop_all_policies('public', 'staff_categories');
SELECT public._drop_all_policies('public', 'player_guardian_relationships');
SELECT public._drop_all_policies('public', 'tutor_athlete_relations');

CREATE POLICY categories_select_authenticated ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY categories_insert_authorized ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_operational_staff() AND public.has_app_permission('categories.create'));
CREATE POLICY categories_update_authorized ON public.categories FOR UPDATE TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('categories.edit')) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('categories.edit'));
CREATE POLICY categories_delete_authorized ON public.categories FOR DELETE TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('categories.delete'));
CREATE POLICY player_categories_select_authorized ON public.player_categories FOR SELECT TO authenticated USING (public.can_view_player_category_membership(player_id));
CREATE POLICY player_categories_insert_authorized ON public.player_categories FOR INSERT TO authenticated WITH CHECK (public.can_manage_player_category_membership(category_id));
CREATE POLICY player_categories_update_authorized ON public.player_categories FOR UPDATE TO authenticated USING (public.can_manage_player_category_membership(category_id)) WITH CHECK (public.can_manage_player_category_membership(category_id));
CREATE POLICY player_categories_delete_authorized ON public.player_categories FOR DELETE TO authenticated USING (public.can_manage_player_category_membership(category_id));
CREATE POLICY staff_categories_select_authorized ON public.staff_categories FOR SELECT TO authenticated USING (public.can_view_staff_category_membership(user_id));
CREATE POLICY staff_categories_insert_authorized ON public.staff_categories FOR INSERT TO authenticated WITH CHECK (public.can_manage_staff_category_membership());
CREATE POLICY staff_categories_update_authorized ON public.staff_categories FOR UPDATE TO authenticated USING (public.can_manage_staff_category_membership()) WITH CHECK (public.can_manage_staff_category_membership());
CREATE POLICY staff_categories_delete_authorized ON public.staff_categories FOR DELETE TO authenticated USING (public.can_manage_staff_category_membership());
CREATE POLICY player_guardian_relationships_select_authorized ON public.player_guardian_relationships FOR SELECT TO authenticated USING (public.can_view_family_relationship(guardian_person_id, player_person_id));
CREATE POLICY player_guardian_relationships_insert_authorized ON public.player_guardian_relationships FOR INSERT TO authenticated WITH CHECK (public.can_manage_family_relationship(guardian_person_id, player_person_id));
CREATE POLICY player_guardian_relationships_update_authorized ON public.player_guardian_relationships FOR UPDATE TO authenticated USING (public.can_manage_family_relationship(guardian_person_id, player_person_id)) WITH CHECK (public.can_manage_family_relationship(guardian_person_id, player_person_id));
CREATE POLICY player_guardian_relationships_delete_authorized ON public.player_guardian_relationships FOR DELETE TO authenticated USING (public.can_manage_family_relationship(guardian_person_id, player_person_id));
CREATE POLICY tutor_athlete_relations_select_authorized ON public.tutor_athlete_relations FOR SELECT TO authenticated USING (public.can_view_tutor_relationship(tutor_id, athlete_id));
CREATE POLICY tutor_athlete_relations_insert_authorized ON public.tutor_athlete_relations FOR INSERT TO authenticated WITH CHECK (public.can_manage_tutor_relationship(tutor_id, athlete_id));
CREATE POLICY tutor_athlete_relations_update_authorized ON public.tutor_athlete_relations FOR UPDATE TO authenticated USING (public.can_manage_tutor_relationship(tutor_id, athlete_id)) WITH CHECK (public.can_manage_tutor_relationship(tutor_id, athlete_id));
CREATE POLICY tutor_athlete_relations_delete_authorized ON public.tutor_athlete_relations FOR DELETE TO authenticated USING (public.can_manage_tutor_relationship(tutor_id, athlete_id));

UPDATE storage.buckets SET public = false WHERE id IN ('docs', 'injury-docs');
DROP POLICY IF EXISTS "Authenticated can delete docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete injury-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated insert injury-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read injury-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update injury-docs" ON storage.objects;
DROP POLICY IF EXISTS storage_docs_select_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_docs_insert_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_docs_update_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_docs_delete_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_injury_docs_select_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_injury_docs_insert_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_injury_docs_update_authorized ON storage.objects;
DROP POLICY IF EXISTS storage_injury_docs_delete_authorized ON storage.objects;
DROP POLICY IF EXISTS brand_mobile_app_logo_public_read ON storage.objects;
CREATE POLICY storage_docs_select_authorized ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'docs' AND public.can_view_docs_storage_object(name));
CREATE POLICY storage_docs_insert_authorized ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'docs' AND public.can_manage_docs_storage_object(name));
CREATE POLICY storage_docs_update_authorized ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'docs' AND public.can_manage_docs_storage_object(name)) WITH CHECK (bucket_id = 'docs' AND public.can_manage_docs_storage_object(name));
CREATE POLICY storage_docs_delete_authorized ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'docs' AND public.can_manage_docs_storage_object(name));
CREATE POLICY storage_injury_docs_select_authorized ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'injury-docs' AND public.can_view_injury_storage_object(name));
CREATE POLICY storage_injury_docs_insert_authorized ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'injury-docs' AND public.can_manage_injury_storage_object(name));
CREATE POLICY storage_injury_docs_update_authorized ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'injury-docs' AND public.can_manage_injury_storage_object(name)) WITH CHECK (bucket_id = 'injury-docs' AND public.can_manage_injury_storage_object(name));
CREATE POLICY storage_injury_docs_delete_authorized ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'injury-docs' AND public.can_manage_injury_storage_object(name));
-- Eccezione intenzionale: il logo mobile serve anche prima dell'autenticazione.
CREATE POLICY brand_mobile_app_logo_public_read ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'docs' AND name LIKE 'brand/mobile-app-logo.%');

REVOKE ALL ON TABLE public.categories, public.player_categories, public.staff_categories,
  public.player_guardian_relationships, public.tutor_athlete_relations FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories, public.player_categories,
  public.staff_categories, public.player_guardian_relationships, public.tutor_athlete_relations TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
