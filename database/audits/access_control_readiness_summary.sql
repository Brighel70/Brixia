-- =============================================================================
-- Riepilogo access-control readiness (sola lettura)
-- =============================================================================
-- Versione compatta dell'audit: restituisce un solo risultato facilmente
-- copiabile dall'editor SQL di Supabase.

WITH checks AS (
  SELECT 'A1_profili_senza_persona' AS verifica, count(*)::text AS risultato
  FROM public.profiles
  WHERE person_id IS NULL

  UNION ALL

  SELECT 'A1a_admin_supporto_senza_persona', count(*)::text
  FROM public.profiles
  WHERE person_id IS NULL
    AND lower(trim(coalesce(role, ''))) = 'admin'

  UNION ALL

  SELECT 'A1b_altri_profili_senza_persona', count(*)::text
  FROM public.profiles
  WHERE person_id IS NULL
    AND lower(trim(coalesce(role, ''))) <> 'admin'

  UNION ALL

  SELECT 'A2_persone_con_piu_profili', count(*)::text
  FROM (
    SELECT person_id
    FROM public.profiles
    WHERE person_id IS NOT NULL
    GROUP BY person_id
    HAVING count(*) > 1
  ) duplicate_profiles

  UNION ALL

  SELECT 'B1_profili_con_ruolo_id_non_valido', count(*)::text
  FROM public.profiles pr
  LEFT JOIN public.user_roles ur ON ur.id = pr.user_role_id
  WHERE pr.user_role_id IS NOT NULL AND ur.id IS NULL

  UNION ALL

  SELECT 'C1_accessi_teamflow_senza_codice', count(*)::text
  FROM public.people
  WHERE COALESCE(teamflow_access_blocked, false) = false
    AND teamflow_app_role IS NOT NULL
    AND NULLIF(btrim(invite_code_teamflow), '') IS NULL

  UNION ALL

  SELECT 'C2_accessi_flowme_senza_codice', count(*)::text
  FROM public.people
  WHERE COALESCE(flowme_access_blocked, false) = false
    AND app_role IS NOT NULL
    AND NULLIF(btrim(invite_code), '') IS NULL
), table_stats AS (
  SELECT
    c.relname AS tabella,
    c.relrowsecurity AS rls_attiva,
    count(p.policyname) AS numero_policy
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'people', 'categories', 'attendance', 'training_sessions', 'activities',
      'events', 'injuries', 'fees', 'fee_assignments', 'payments',
      'documents', 'tutor_athlete_relations', 'player_guardian_relationships'
    )
  GROUP BY c.relname, c.relrowsecurity
), table_state AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'tabella', tabella,
      'rls_attiva', rls_attiva,
      'numero_policy', numero_policy
    ) ORDER BY tabella
  ) AS risultato
  FROM table_stats
)
SELECT jsonb_build_object(
  'controlli_identita', (SELECT jsonb_object_agg(verifica, risultato) FROM checks),
  'stato_tabelle', COALESCE((SELECT risultato FROM table_state), '[]'::jsonb)
) AS audit;
