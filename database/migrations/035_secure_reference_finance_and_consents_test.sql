-- Verifica post-esecuzione 035. Sola lettura.
WITH expected_tables(tablename) AS (
  VALUES
    ('brand_settings'::text), ('event_types'::text), ('insurance_event_types'::text),
    ('training_venues'::text), ('player_positions'::text), ('professional_categories'::text),
    ('origin_clubs'::text), ('fee_discounts'::text), ('fee_templates'::text),
    ('payment_receipts'::text), ('person_receipt_recipients'::text),
    ('receipt_header_settings'::text), ('templates_documenti'::text),
    ('consent_types'::text), ('person_consents'::text), ('medical_certificates'::text),
    ('documenti_deposito'::text), ('message_templates'::text),
    ('activity_modification_notifications'::text)
), table_check AS (
  SELECT expected.tablename, COALESCE(class.relrowsecurity, false) AS rls_active,
    COALESCE((SELECT bool_and(policy.roles = ARRAY['authenticated']::name[] OR
      (expected.tablename = 'brand_settings' AND policy.policyname = 'brand_settings_select_public'
       AND policy.roles = ARRAY['anon', 'authenticated']::name[]))
      FROM pg_policies policy WHERE policy.schemaname = 'public' AND policy.tablename = expected.tablename), false) AS policies_scoped
  FROM expected_tables expected
  LEFT JOIN pg_class class ON class.relname = expected.tablename AND class.relnamespace = 'public'::regnamespace
), helper_check AS (
  SELECT bool_and(to_regprocedure(signature) IS NOT NULL) AS helpers_present
  FROM (VALUES
    ('public.can_view_operational_reference()'::text),
    ('public.can_manage_operational_reference()'::text),
    ('public.can_sign_consent_for_person(uuid,uuid)'::text),
    ('public.can_view_payment_receipt(uuid)'::text)
  ) AS expected(signature)
)
SELECT 'T1_secure_reference_finance_and_consents' AS check_id,
  (SELECT bool_and(rls_active) FROM table_check) AS all_rls_active,
  (SELECT bool_and(policies_scoped) FROM table_check) AS policies_scoped,
  (SELECT helpers_present FROM helper_check) AS access_helpers_present,
  EXISTS (SELECT 1 FROM pg_policies policy WHERE policy.schemaname = 'public'
    AND policy.tablename = 'brand_settings' AND policy.policyname = 'brand_settings_select_public') AS intentional_public_brand_read;
