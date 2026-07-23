-- =============================================================================
-- 035_secure_reference_finance_and_consents.sql
-- Recuperata dallo stato applicato in Supabase il 21/07/2026.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.can_view_operational_reference()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_app_admin() OR public.has_app_permission('settings.view')
    OR public.has_app_permission('events.view') OR public.has_app_permission('sessions.view')
    OR public.has_app_permission('players.view') OR public.has_app_permission('staff.view')
    OR public.has_app_permission('health.view') OR public.has_app_permission('fees.view'));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_operational_reference()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.is_app_admin() OR public.has_app_permission('settings.edit');
$$;
CREATE OR REPLACE FUNCTION public.can_sign_consent_for_person(p_person_id uuid, p_signed_by_person_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT auth.uid() IS NOT NULL AND p_signed_by_person_id = public.get_my_person_id() AND (
    p_person_id = public.get_my_person_id()
    OR EXISTS (SELECT 1 FROM public.player_guardian_relationships r WHERE r.guardian_person_id = public.get_my_person_id() AND r.player_person_id = p_person_id)
    OR EXISTS (SELECT 1 FROM public.tutor_athlete_relations r WHERE r.tutor_id = public.get_my_person_id() AND r.athlete_id = p_person_id)
  );
$$;
CREATE OR REPLACE FUNCTION public.can_view_payment_receipt(p_receipt_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT auth.uid() IS NOT NULL AND public.has_app_permission('fees.view') AND EXISTS (
    SELECT 1 FROM public.payment_receipts receipt JOIN public.fee_assignments assignment ON assignment.id = receipt.fee_assignment_id
    WHERE receipt.id = p_receipt_id AND public.can_view_person(assignment.person_id)
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_operational_reference(), public.can_manage_operational_reference(),
  public.can_sign_consent_for_person(uuid, uuid), public.can_view_payment_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_operational_reference(), public.can_manage_operational_reference(),
  public.can_sign_consent_for_person(uuid, uuid), public.can_view_payment_receipt(uuid) TO authenticated, service_role;

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'brand_settings');
CREATE POLICY brand_settings_select_public ON public.brand_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY brand_settings_write_authorized ON public.brand_settings FOR ALL TO authenticated
  USING (public.has_app_permission('brand.manage') OR public.has_app_permission('settings.brand'))
  WITH CHECK (public.has_app_permission('brand.manage') OR public.has_app_permission('settings.brand'));
REVOKE ALL ON TABLE public.brand_settings FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.brand_settings TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.brand_settings TO authenticated, service_role;

-- Tabelle di configurazione: lettura agli utenti rilevanti, modifica impostazioni.
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origin_clubs ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'event_types');
SELECT public._drop_all_policies('public', 'insurance_event_types');
SELECT public._drop_all_policies('public', 'training_venues');
SELECT public._drop_all_policies('public', 'player_positions');
SELECT public._drop_all_policies('public', 'professional_categories');
SELECT public._drop_all_policies('public', 'origin_clubs');
CREATE POLICY event_types_select_authorized ON public.event_types FOR SELECT TO authenticated USING (public.can_view_operational_reference());
CREATE POLICY event_types_write_authorized ON public.event_types FOR ALL TO authenticated USING (public.can_manage_operational_reference()) WITH CHECK (public.can_manage_operational_reference());
CREATE POLICY insurance_event_types_select_authorized ON public.insurance_event_types FOR SELECT TO authenticated USING (public.has_app_permission('health.view'));
CREATE POLICY insurance_event_types_write_authorized ON public.insurance_event_types FOR ALL TO authenticated USING (public.has_app_permission('health.manage')) WITH CHECK (public.has_app_permission('health.manage'));
CREATE POLICY training_venues_select_authorized ON public.training_venues FOR SELECT TO authenticated USING (public.can_view_operational_reference());
CREATE POLICY training_venues_write_authorized ON public.training_venues FOR ALL TO authenticated USING (public.can_manage_operational_reference()) WITH CHECK (public.can_manage_operational_reference());
CREATE POLICY player_positions_select_authorized ON public.player_positions FOR SELECT TO authenticated USING (public.has_app_permission('players.view'));
CREATE POLICY player_positions_write_authorized ON public.player_positions FOR ALL TO authenticated USING (public.has_app_permission('players.edit')) WITH CHECK (public.has_app_permission('players.edit'));
CREATE POLICY professional_categories_select_authorized ON public.professional_categories FOR SELECT TO authenticated USING (public.has_app_permission('staff.view'));
CREATE POLICY professional_categories_write_authorized ON public.professional_categories FOR ALL TO authenticated USING (public.can_manage_operational_reference()) WITH CHECK (public.can_manage_operational_reference());
CREATE POLICY origin_clubs_select_authorized ON public.origin_clubs FOR SELECT TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('players.view'));
CREATE POLICY origin_clubs_write_authorized ON public.origin_clubs FOR ALL TO authenticated USING (public.has_app_permission('players.edit')) WITH CHECK (public.has_app_permission('players.edit'));

-- Quote, ricevute e modelli.
ALTER TABLE public.fee_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_receipt_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_header_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates_documenti ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'fee_discounts');
SELECT public._drop_all_policies('public', 'fee_templates');
SELECT public._drop_all_policies('public', 'payment_receipts');
SELECT public._drop_all_policies('public', 'person_receipt_recipients');
SELECT public._drop_all_policies('public', 'receipt_header_settings');
SELECT public._drop_all_policies('public', 'templates_documenti');
CREATE POLICY fee_discounts_select_authorized ON public.fee_discounts FOR SELECT TO authenticated USING (public.has_app_permission('fees.view'));
CREATE POLICY fee_discounts_write_authorized ON public.fee_discounts FOR ALL TO authenticated USING (public.can_manage_fees()) WITH CHECK (public.can_manage_fees());
CREATE POLICY fee_templates_select_authorized ON public.fee_templates FOR SELECT TO authenticated USING (public.has_app_permission('fees.view'));
CREATE POLICY fee_templates_write_authorized ON public.fee_templates FOR ALL TO authenticated USING (public.can_manage_fees()) WITH CHECK (public.can_manage_fees());
CREATE POLICY payment_receipts_select_authorized ON public.payment_receipts FOR SELECT TO authenticated USING (public.can_view_payment_receipt(id));
CREATE POLICY payment_receipts_write_authorized ON public.payment_receipts FOR ALL TO authenticated USING (public.can_manage_fees()) WITH CHECK (public.can_manage_fees());
CREATE POLICY person_receipt_recipients_select_authorized ON public.person_receipt_recipients FOR SELECT TO authenticated USING (public.has_app_permission('fees.view') AND public.can_view_person(person_id) AND public.can_view_person(recipient_person_id));
CREATE POLICY person_receipt_recipients_write_authorized ON public.person_receipt_recipients FOR ALL TO authenticated USING (public.can_manage_fees()) WITH CHECK (public.can_manage_fees() AND public.can_view_person(person_id) AND public.can_view_person(recipient_person_id));
CREATE POLICY receipt_header_settings_select_authorized ON public.receipt_header_settings FOR SELECT TO authenticated USING (public.has_app_permission('fees.view'));
CREATE POLICY receipt_header_settings_write_authorized ON public.receipt_header_settings FOR ALL TO authenticated USING (public.can_manage_fees()) WITH CHECK (public.can_manage_fees());
CREATE POLICY templates_documenti_select_authorized ON public.templates_documenti FOR SELECT TO authenticated USING (public.has_app_permission('fees.view'));
CREATE POLICY templates_documenti_write_authorized ON public.templates_documenti FOR ALL TO authenticated USING (public.can_manage_fees()) WITH CHECK (public.can_manage_fees());

-- Consensi, certificati e modelli messaggio.
ALTER TABLE public.consent_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documenti_deposito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_modification_notifications ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'consent_types');
SELECT public._drop_all_policies('public', 'person_consents');
SELECT public._drop_all_policies('public', 'medical_certificates');
SELECT public._drop_all_policies('public', 'documenti_deposito');
SELECT public._drop_all_policies('public', 'message_templates');
SELECT public._drop_all_policies('public', 'activity_modification_notifications');
CREATE POLICY consent_types_select_authenticated ON public.consent_types FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY consent_types_write_authorized ON public.consent_types FOR ALL TO authenticated USING (public.can_manage_operational_reference()) WITH CHECK (public.can_manage_operational_reference());
CREATE POLICY person_consents_select_authorized ON public.person_consents FOR SELECT TO authenticated USING (public.has_app_permission('documents.view') AND public.can_view_person(person_id));
CREATE POLICY person_consents_insert_authorized ON public.person_consents FOR INSERT TO authenticated WITH CHECK (((public.is_operational_staff() AND public.has_app_permission('documents.manage')) AND public.can_view_person(person_id)) OR public.can_sign_consent_for_person(person_id, signed_by_person_id));
CREATE POLICY medical_certificates_select_authorized ON public.medical_certificates FOR SELECT TO authenticated USING (public.has_app_permission('health.view') AND public.can_view_person(person_id));
CREATE POLICY medical_certificates_write_authorized ON public.medical_certificates FOR ALL TO authenticated USING (public.has_app_permission('health.manage') AND public.can_view_person(person_id)) WITH CHECK (public.has_app_permission('health.manage') AND public.can_view_person(person_id));
CREATE POLICY documenti_deposito_select_authorized ON public.documenti_deposito FOR SELECT TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('documents.view'));
CREATE POLICY documenti_deposito_write_authorized ON public.documenti_deposito FOR ALL TO authenticated USING (public.is_operational_staff() AND public.has_app_permission('documents.manage')) WITH CHECK (public.is_operational_staff() AND public.has_app_permission('documents.manage'));
CREATE POLICY message_templates_select_authorized ON public.message_templates FOR SELECT TO authenticated USING (public.has_app_permission('settings.view'));
CREATE POLICY message_templates_write_authorized ON public.message_templates FOR ALL TO authenticated USING (public.can_manage_operational_reference()) WITH CHECK (public.can_manage_operational_reference());
CREATE POLICY activity_modification_notifications_select_authorized ON public.activity_modification_notifications FOR SELECT TO authenticated USING (public.is_operational_staff() AND (public.has_app_permission('sessions.view') OR public.has_app_permission('events.view')));
CREATE POLICY activity_modification_notifications_insert_authorized ON public.activity_modification_notifications FOR INSERT TO authenticated WITH CHECK (public.is_operational_staff() AND (public.has_app_permission('sessions.edit') OR public.has_app_permission('events.edit') OR public.has_app_permission('players.edit')));
CREATE POLICY activity_modification_notifications_delete_authorized ON public.activity_modification_notifications FOR DELETE TO authenticated USING (public.is_app_admin());

REVOKE ALL ON TABLE public.event_types, public.insurance_event_types, public.training_venues,
  public.player_positions, public.professional_categories, public.origin_clubs, public.fee_discounts,
  public.fee_templates, public.payment_receipts, public.person_receipt_recipients,
  public.receipt_header_settings, public.templates_documenti, public.consent_types,
  public.person_consents, public.medical_certificates, public.documenti_deposito,
  public.message_templates, public.activity_modification_notifications FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_types, public.insurance_event_types,
  public.training_venues, public.player_positions, public.professional_categories, public.origin_clubs,
  public.fee_discounts, public.fee_templates, public.payment_receipts, public.person_receipt_recipients,
  public.receipt_header_settings, public.templates_documenti, public.consent_types, public.person_consents,
  public.medical_certificates, public.documenti_deposito, public.message_templates,
  public.activity_modification_notifications TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

