-- =============================================================================
-- Audit in sola lettura delle tabelle operative/legacy ancora da classificare.
-- Non modifica dati, RLS, policy o permessi.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES
    ('activity_modification_notifications'::text),
    ('brand_settings'::text),
    ('consent_types'::text),
    ('documenti_deposito'::text),
    ('event_types'::text),
    ('fee_discounts'::text),
    ('fee_templates'::text),
    ('guardians'::text),
    ('insurance_event_types'::text),
    ('match_lists'::text),
    ('match_statistics'::text),
    ('medical_certificates'::text),
    ('message_templates'::text),
    ('notes'::text),
    ('origin_clubs'::text),
    ('payment_receipts'::text),
    ('person_consents'::text),
    ('person_receipt_recipients'::text),
    ('player_positions'::text),
    ('players'::text),
    ('professional_categories'::text),
    ('receipt_header_settings'::text),
    ('templates_documenti'::text),
    ('training_locations'::text),
    ('training_venues'::text),
    ('tutors'::text),
    ('visit_day_schedules'::text),
    ('visit_list_entries'::text)
),
table_state AS (
  SELECT
    watched.tablename,
    to_regclass(format('public.%I', watched.tablename)) IS NOT NULL AS table_exists,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', column_info.column_name,
        'type', column_info.data_type,
        'nullable', column_info.is_nullable
      ) ORDER BY column_info.ordinal_position)
      FROM information_schema.columns column_info
      WHERE column_info.table_schema = 'public'
        AND column_info.table_name = watched.tablename
    ), '[]'::jsonb) AS columns,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', policy.policyname,
        'command', policy.cmd,
        'roles', policy.roles,
        'using', policy.qual,
        'check', policy.with_check
      ) ORDER BY policy.policyname)
      FROM pg_policies policy
      WHERE policy.schemaname = 'public'
        AND policy.tablename = watched.tablename
    ), '[]'::jsonb) AS policies
  FROM watched_tables watched
  LEFT JOIN pg_class class
    ON class.relname = watched.tablename
   AND class.relnamespace = 'public'::regnamespace
)
SELECT
  'T7_remaining_operational_access_readiness' AS check_id,
  jsonb_agg(jsonb_build_object(
    'table', table_state.tablename,
    'exists', table_state.table_exists,
    'rls_active', table_state.rls_active,
    'columns', table_state.columns,
    'policies', table_state.policies
  ) ORDER BY table_state.tablename) AS tables
FROM table_state;
