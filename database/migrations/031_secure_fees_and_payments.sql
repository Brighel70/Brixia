-- =============================================================================
-- 031_secure_fees_and_payments.sql
--
-- Protegge catalogo quote, assegnazioni e registro pagamenti.
-- Famiglie/giocatori possono consultare solo quote che li riguardano;
-- lo staff autorizzato alla gestione quote mantiene l'operativita completa.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_manage_fees()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_operational_staff()
     AND public.has_app_permission('fees.manage');
$$;

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
      public.is_operational_staff()
      OR EXISTS (
        SELECT 1
        FROM public.fee_assignments assignment
        WHERE assignment.fee_id = p_fee_id
          AND public.can_view_person(assignment.person_id)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_payment(p_payment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND public.has_app_permission('fees.view')
    AND EXISTS (
      SELECT 1
      FROM public.payments payment
      JOIN public.fee_assignments assignment ON assignment.id = payment.assignment_id
      WHERE payment.id = p_payment_id
        AND public.can_view_person(assignment.person_id)
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_fees() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_fee(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fees() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_fee(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_payment(uuid) TO authenticated, service_role;

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

SELECT public._drop_all_policies('public', 'fees');
SELECT public._drop_all_policies('public', 'fee_assignments');
SELECT public._drop_all_policies('public', 'payments');

CREATE POLICY fees_select_authorized
  ON public.fees
  FOR SELECT TO authenticated
  USING (public.can_view_fee(id));

CREATE POLICY fees_insert_authorized
  ON public.fees
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fees());

CREATE POLICY fees_update_authorized
  ON public.fees
  FOR UPDATE TO authenticated
  USING (public.can_manage_fees())
  WITH CHECK (public.can_manage_fees());

CREATE POLICY fees_delete_authorized
  ON public.fees
  FOR DELETE TO authenticated
  USING (public.can_manage_fees());

CREATE POLICY fee_assignments_select_authorized
  ON public.fee_assignments
  FOR SELECT TO authenticated
  USING (
    public.has_app_permission('fees.view')
    AND public.can_view_person(person_id)
  );

CREATE POLICY fee_assignments_insert_authorized
  ON public.fee_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_fees()
    AND public.can_view_person(person_id)
  );

CREATE POLICY fee_assignments_update_authorized
  ON public.fee_assignments
  FOR UPDATE TO authenticated
  USING (public.can_manage_fees())
  WITH CHECK (
    public.can_manage_fees()
    AND public.can_view_person(person_id)
  );

CREATE POLICY fee_assignments_delete_authorized
  ON public.fee_assignments
  FOR DELETE TO authenticated
  USING (public.can_manage_fees());

CREATE POLICY payments_select_authorized
  ON public.payments
  FOR SELECT TO authenticated
  USING (public.can_view_payment(id));

CREATE POLICY payments_insert_authorized
  ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fees());

CREATE POLICY payments_update_authorized
  ON public.payments
  FOR UPDATE TO authenticated
  USING (public.can_manage_fees())
  WITH CHECK (public.can_manage_fees());

CREATE POLICY payments_delete_authorized
  ON public.payments
  FOR DELETE TO authenticated
  USING (public.can_manage_fees());

REVOKE ALL ON TABLE public.fees FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.fee_assignments FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.payments FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fees TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fee_assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
