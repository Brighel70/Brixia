-- =============================================================================
-- 038 - Correzioni emerse dalla revisione incrociata delle autorizzazioni
--
-- 1. Mantiene il perimetro per categoria anche in modifica/eliminazione persone.
-- 2. Permette l'upload iniziale dei documenti senza esporre il bucket.
-- 3. Limita la creazione di notifiche agli operatori autorizzati sul destinatario.
-- 4. Riporta il catalogo dei permessi al modello lettura diretta / scrittura via RPC.
-- =============================================================================

BEGIN;

-- La versione effettiva in produzione e' gia' limitata per categoria. La
-- riportiamo qui perche' una nuova installazione non ricada nella versione 030,
-- che consentiva a qualunque membro dello staff di leggere tutti.
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
          SELECT 1
          FROM public.people myself
          JOIN public.people target ON target.id = p_person_id
          CROSS JOIN LATERAL jsonb_array_elements_text(
            coalesce(myself.staff_categories, '[]'::jsonb)
            || coalesce(myself.teamflow_staff_categories, '[]'::jsonb)
          ) AS assigned_category(category_id)
          WHERE myself.id = public.get_my_person_id()
            AND (
              coalesce(target.player_categories, '[]'::jsonb) ? assigned_category.category_id
              OR coalesce(target.staff_categories, '[]'::jsonb) ? assigned_category.category_id
              OR coalesce(target.teamflow_staff_categories, '[]'::jsonb) ? assigned_category.category_id
            )
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

-- Non basta possedere il permesso: il record deve anche ricadere nel perimetro
-- leggibile dell'operatore, prima e dopo una modifica.
DROP POLICY IF EXISTS people_update_authorized ON public.people;
DROP POLICY IF EXISTS people_delete_authorized ON public.people;

CREATE POLICY people_update_authorized
  ON public.people
  FOR UPDATE TO authenticated
  USING (
    public.can_view_person(id)
    AND (
      public.has_app_permission('players.edit')
      OR public.has_app_permission('staff.edit')
      OR public.has_app_permission('users.edit')
    )
  )
  WITH CHECK (
    public.can_view_person(id)
    AND (
      public.has_app_permission('players.edit')
      OR public.has_app_permission('staff.edit')
      OR public.has_app_permission('users.edit')
    )
  );

CREATE POLICY people_delete_authorized
  ON public.people
  FOR DELETE TO authenticated
  USING (
    public.can_view_person(id)
    AND (
      public.has_app_permission('players.delete')
      OR public.has_app_permission('staff.delete')
      OR public.has_app_permission('users.delete')
    )
  );

-- Il frontend deve prima caricare il file e soltanto dopo crea la riga in
-- documents. Per l'INSERT sul bucket verifichiamo quindi il person_id nel path,
-- non una riga documents che in quel momento non esiste ancora.
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
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_docs_storage_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_docs_storage_object(text) TO authenticated, service_role;

-- Le notifiche non possono piu' essere create da qualunque utente autenticato.
-- Un operatore deve avere almeno un permesso operativo e poter vedere il
-- destinatario; l'admin conserva il proprio perimetro completo.
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

DROP POLICY IF EXISTS notifications_insert_authenticated ON public.notifications;
CREATE POLICY notifications_insert_authorized
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.can_create_notification(user_id, person_id));

-- Cataloghi leggibili per l'interfaccia dagli utenti autenticati. Le modifiche
-- ai permessi personalizzati restano consentite solamente tramite RPC sicure.
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_select_authenticated ON public.permissions;
DROP POLICY IF EXISTS role_permissions_select_authenticated ON public.role_permissions;

CREATE POLICY permissions_select_authenticated
  ON public.permissions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.permissions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_permissions FROM authenticated;
GRANT SELECT ON TABLE public.permissions, public.role_permissions TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

