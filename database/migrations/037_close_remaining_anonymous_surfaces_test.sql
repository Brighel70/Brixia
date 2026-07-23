-- Verifica post-esecuzione 037. Sola lettura.
WITH expected_tables(tablename) AS (
  VALUES
    ('correspondence_home_hidden'::text), ('correspondence_home_opened'::text),
    ('correspondence_messages'::text), ('correspondence_participants'::text),
    ('correspondence_reads'::text), ('correspondence_threads'::text),
    ('council_members'::text), ('notifications'::text), ('permissions'::text),
    ('push_subscriptions'::text), ('push_tokens'::text), ('user_memos'::text),
    ('user_permissions'::text), ('user_roles'::text)
), table_check AS (
  SELECT expected.tablename,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    NOT (
      has_table_privilege('anon', format('public.%I', expected.tablename), 'SELECT') OR
      has_table_privilege('anon', format('public.%I', expected.tablename), 'INSERT') OR
      has_table_privilege('anon', format('public.%I', expected.tablename), 'UPDATE') OR
      has_table_privilege('anon', format('public.%I', expected.tablename), 'DELETE')
    ) AS anon_has_no_privileges,
    NOT EXISTS (
      SELECT 1 FROM pg_policies policy
      WHERE policy.schemaname = 'public' AND policy.tablename = expected.tablename
        AND (policy.roles @> ARRAY['public']::name[] OR policy.roles @> ARRAY['anon']::name[])
    ) AS no_public_or_anon_policies
  FROM expected_tables expected
  LEFT JOIN pg_class class ON class.relname = expected.tablename AND class.relnamespace = 'public'::regnamespace
)
SELECT 'T1_close_remaining_anonymous_surfaces' AS check_id,
  bool_and(rls_active) AS all_rls_active,
  bool_and(anon_has_no_privileges) AS no_anonymous_privileges,
  bool_and(no_public_or_anon_policies) AS no_public_or_anonymous_policies,
  EXISTS (
    SELECT 1 FROM pg_policies policy
    WHERE policy.schemaname = 'public' AND policy.tablename = 'brand_settings'
      AND policy.policyname = 'brand_settings_select_public'
  ) AS intentional_public_brand_read
FROM table_check;
