-- =============================================================================
-- 046_allow_events_docs_storage.sql
-- =============================================================================
-- I verbali/allegati eventi sono salvati nel bucket `docs` con path `events/...`.
-- Dopo 038/039 l'upload era consentito solo su `people/<uuid>/...`, quindi il
-- caricamento del verbale consiglio falliva con RLS (StorageApiError).
--
-- Estende can_view/can_manage_docs_storage_object per i path `events/`,
-- riservati a chi ha permessi eventi (o admin). Non tocca people/ ne' brand/.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_docs_storage_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_object_name ~ '^events/'
      THEN public.is_app_admin()
        OR public.has_app_permission('events.view')
        OR public.has_app_permission('events.create')
        OR public.has_app_permission('events.edit')
        OR public.has_app_permission('events.delete')
    ELSE EXISTS (
      SELECT 1
      FROM public.documents document
      WHERE document.file_path = p_object_name
        AND public.can_view_document(document.id)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_docs_storage_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN p_object_name ~ '^events/'
      THEN public.is_app_admin()
        OR public.has_app_permission('events.create')
        OR public.has_app_permission('events.edit')
        OR public.has_app_permission('events.delete')
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

REVOKE ALL ON FUNCTION public.can_view_docs_storage_object(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_manage_docs_storage_object(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_docs_storage_object(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_docs_storage_object(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_view_docs_storage_object(text) IS
  'Lettura bucket docs: documenti anagrafici collegati, oppure path events/ con permesso eventi.';

COMMENT ON FUNCTION public.can_manage_docs_storage_object(text) IS
  'Scrittura bucket docs: people/<uuid>/ (upload iniziale), legacy collegati a documents, oppure events/ con permesso eventi.';

COMMIT;
