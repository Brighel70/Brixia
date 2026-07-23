-- =============================================================================
-- Identita, anagrafiche e quote: verifica di preparazione alla RLS.
--
-- Questo file NON modifica dati, policy, permessi o funzioni.
-- Eseguirlo nel SQL Editor Supabase e condividere l'unica riga restituita.
-- =============================================================================

WITH watched_tables(tablename) AS (
  VALUES
    ('profiles'::text),
    ('people'::text),
    ('user_roles'::text),
    ('permissions'::text),
    ('role_permissions'::text),
    ('user_permissions'::text),
    ('fees'::text),
    ('fee_assignments'::text),
    ('payments'::text)
),
table_security AS (
  SELECT
    watched.tablename,
    COALESCE(class.relrowsecurity, false) AS rls_active,
    COALESCE(policy_count.count, 0) AS policy_count,
    COALESCE(privileges.authenticated_write, false) AS authenticated_can_write,
    COALESCE(privileges.anon_can_read, false) AS anon_can_read
  FROM watched_tables watched
  LEFT JOIN pg_class class
    ON class.relname = watched.tablename
   AND class.relnamespace = 'public'::regnamespace
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS count
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = watched.tablename
  ) policy_count ON true
  LEFT JOIN LATERAL (
    SELECT
      bool_or(privilege_type IN ('INSERT', 'UPDATE', 'DELETE')) FILTER (WHERE grantee = 'authenticated') AS authenticated_write,
      bool_or(privilege_type = 'SELECT') FILTER (WHERE grantee IN ('anon', 'PUBLIC')) AS anon_can_read
    FROM information_schema.role_table_grants grant_info
    WHERE grant_info.table_schema = 'public'
      AND grant_info.table_name = watched.tablename
  ) privileges ON true
),
identity_state AS (
  SELECT jsonb_build_object(
    'profili_senza_utente_auth', (
      SELECT count(*)
      FROM public.profiles profile
      LEFT JOIN auth.users auth_user ON auth_user.id = profile.id
      WHERE auth_user.id IS NULL
    ),
    'utenti_auth_senza_profilo', (
      SELECT count(*)
      FROM auth.users auth_user
      LEFT JOIN public.profiles profile ON profile.id = auth_user.id
      WHERE profile.id IS NULL
    ),
    'profili_persona_non_valida', (
      SELECT count(*)
      FROM public.profiles profile
      LEFT JOIN public.people person ON person.id = profile.person_id
      WHERE profile.person_id IS NOT NULL AND person.id IS NULL
    ),
    'persone_con_accesso_teamflow_bloccato', (
      SELECT count(*)
      FROM public.people
      WHERE COALESCE(teamflow_access_blocked, false)
    ),
    'persone_con_accesso_flowme_bloccato', (
      SELECT count(*)
      FROM public.people
      WHERE COALESCE(flowme_access_blocked, false)
    )
  ) AS value
),
function_state AS (
  SELECT jsonb_object_agg(
    required.name,
    COALESCE(found.is_present, false)
  ) AS value
  FROM (
    VALUES
      ('get_my_person_id'::text),
      ('is_app_admin'::text),
      ('has_app_permission'::text)
  ) AS required(name)
  LEFT JOIN LATERAL (
    SELECT true AS is_present
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = required.name
    LIMIT 1
  ) found ON true
)
SELECT
  'T1_identity_finance_rls_readiness' AS check_id,
  (SELECT value FROM identity_state) AS identity,
  (SELECT value FROM function_state) AS helpers,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'table', table_security.tablename,
        'rls_active', table_security.rls_active,
        'policies', table_security.policy_count,
        'authenticated_can_write', table_security.authenticated_can_write,
        'anon_can_read', table_security.anon_can_read
      )
      ORDER BY table_security.tablename
    ),
    '[]'::jsonb
  ) AS tables
FROM table_security;
