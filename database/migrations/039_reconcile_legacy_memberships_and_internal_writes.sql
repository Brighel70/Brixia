-- =============================================================================
-- 039 - Allineamento membership categoria e chiusura autorizzazioni residue
--
-- Le colonne JSON in people sono la fonte corrente dell'applicazione, mentre
-- player_categories e staff_categories esistono per dati e flussi legacy.
-- La RLS considera entrambe, evitando che record validi ma solo legacy spariscano
-- agli operatori della categoria.
-- =============================================================================

BEGIN;

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
        public.has_club_wide_operational_scope()
        AND (
          public.has_app_permission('players.view')
          OR public.has_app_permission('staff.view')
          OR public.has_app_permission('health.view')
          OR public.has_app_permission('fees.view')
          OR public.has_app_permission('documents.view')
        )
      )
      OR (
        public.is_operational_staff()
        AND (
          public.has_app_permission('players.view')
          OR public.has_app_permission('staff.view')
          OR public.has_app_permission('health.view')
          OR public.has_app_permission('fees.view')
          OR public.has_app_permission('documents.view')
        )
        AND EXISTS (
          WITH my_categories AS (
            SELECT jsonb_array_elements_text(
              coalesce(myself.staff_categories, '[]'::jsonb)
              || coalesce(myself.teamflow_staff_categories, '[]'::jsonb)
            ) AS category_id
            FROM public.people myself
            WHERE myself.id = public.get_my_person_id()

            UNION

            SELECT membership.category_id::text
            FROM public.staff_categories membership
            LEFT JOIN public.profiles profile ON profile.id = membership.user_id
            WHERE membership.user_id = auth.uid()
              OR membership.user_id = public.get_my_person_id()
              OR profile.person_id = public.get_my_person_id()
          ),
          target_categories AS (
            SELECT jsonb_array_elements_text(
              coalesce(target.player_categories, '[]'::jsonb)
              || coalesce(target.staff_categories, '[]'::jsonb)
              || coalesce(target.teamflow_staff_categories, '[]'::jsonb)
            ) AS category_id
            FROM public.people target
            WHERE target.id = p_person_id

            UNION

            SELECT membership.category_id::text
            FROM public.player_categories membership
            WHERE membership.player_id = p_person_id

            UNION

            SELECT membership.category_id::text
            FROM public.staff_categories membership
            LEFT JOIN public.profiles profile ON profile.id = membership.user_id
            WHERE membership.user_id = p_person_id
              OR profile.person_id = p_person_id
          )
          SELECT 1
          FROM my_categories assigned
          JOIN target_categories target USING (category_id)
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

REVOKE ALL ON FUNCTION public.can_view_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_person(uuid) TO authenticated, service_role;

-- Nuovi upload: solo path people/<uuid>/ validati. File legacy: gestibili
-- esclusivamente se sono gia' collegati a un documento autorizzato.
CREATE OR REPLACE FUNCTION public.can_manage_docs_storage_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_object_name ~ '^people/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      THEN public.can_manage_document(
        (regexp_match(
          p_object_name,
          '^people/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
        ))[1]::uuid
      )
    ELSE EXISTS (
      SELECT 1
      FROM public.documents document
      WHERE document.file_path = p_object_name
        AND public.can_manage_document(document.person_id)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_docs_storage_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_docs_storage_object(text) TO authenticated, service_role;

-- Una notifica deve sempre avere almeno un destinatario, anche per gli
-- operatori autorizzati. Tutti i flussi TeamFlow esistenti ne valorizzano uno.
CREATE OR REPLACE FUNCTION public.can_create_notification(
  p_user_id uuid,
  p_person_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (p_user_id IS NOT NULL OR p_person_id IS NOT NULL)
    AND (
      public.is_app_admin()
      OR (
        public.is_operational_staff()
        AND (
          public.has_app_permission('players.edit')
          OR public.has_app_permission('staff.edit')
          OR public.has_app_permission('sessions.edit')
          OR public.has_app_permission('events.edit')
          OR public.has_app_permission('fees.manage')
          OR public.has_app_permission('documents.manage')
        )
        AND (p_person_id IS NULL OR public.can_view_person(p_person_id))
        AND (
          p_user_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.profiles profile
            WHERE profile.id = p_user_id
              AND (profile.person_id IS NULL OR public.can_view_person(profile.person_id))
          )
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_create_notification(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_notification(uuid, uuid) TO authenticated, service_role;

-- Il frontend legge il catalogo ruoli e usa RPC protette per le modifiche.
-- Non servono quindi scritture dirette sulla tabella dei ruoli.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles FROM authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;

