-- =============================================================================
-- 053 - Ripristino catalogo Quote per staff club-wide
--
-- Sintomo: tab Quote vuota per Segreteria/Dirigente dopo RLS 031.
-- Causa: can_view_fee / can_manage_fees richiedevano solo is_operational_staff()
-- (people.is_staff), ignorando has_club_wide_operational_scope() gia' usato
-- altrove per Dirigente/Segreteria/Medico.
--
-- Effetto: lo staff club-wide con fees.view torna a vedere TUTTE le quote
-- del catalogo (anche non ancora assegnate). Famiglie/giocatori restano
-- limitati alle quote collegate a persone che possono vedere.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_fees()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    public.has_app_permission('fees.manage')
    AND (
      public.is_app_admin()
      OR public.has_club_wide_operational_scope()
      OR public.is_operational_staff()
    );
$$;

COMMENT ON FUNCTION public.can_manage_fees() IS
  'Gestione catalogo/assegnazioni Quote: fees.manage + Admin/club-wide/staff operativo.';

CREATE OR REPLACE FUNCTION public.can_view_fee(p_fee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.has_app_permission('fees.view')
    AND (
      public.is_app_admin()
      OR public.has_club_wide_operational_scope()
      OR public.is_operational_staff()
      OR EXISTS (
        SELECT 1
        FROM public.fee_assignments assignment
        WHERE assignment.fee_id = p_fee_id
          AND public.can_view_person(assignment.person_id)
      )
    );
$$;

COMMENT ON FUNCTION public.can_view_fee(uuid) IS
  'Catalogo completo per Admin/club-wide/staff; altrimenti solo quote gia'' assegnate a persone visibili.';

REVOKE ALL ON FUNCTION public.can_manage_fees() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fees() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.can_view_fee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_fee(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
