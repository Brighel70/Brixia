-- =============================================================================
-- Classificazione degli utenti Auth che non hanno ancora una riga profiles.
--
-- NON modifica dati. Serve a preparare il collegamento sicuro del primo accesso
-- prima di attivare RLS su profiles e people.
-- =============================================================================

WITH auth_without_profile AS (
  SELECT auth_user.id, lower(trim(auth_user.email)) AS email
  FROM auth.users auth_user
  LEFT JOIN public.profiles profile ON profile.id = auth_user.id
  WHERE profile.id IS NULL
),
matches AS (
  SELECT
    auth_user.id,
    auth_user.email,
    count(person.id) FILTER (WHERE person.status = 'active')::int AS active_people_with_same_email,
    count(person.id)::int AS people_with_same_email
  FROM auth_without_profile auth_user
  LEFT JOIN public.people person
    ON lower(trim(person.email)) = auth_user.email
  GROUP BY auth_user.id, auth_user.email
),
classified AS (
  SELECT
    *,
    CASE
      WHEN email IS NULL OR email = '' THEN 'senza_email'
      WHEN active_people_with_same_email = 1 THEN 'collegabile_automaticamente'
      WHEN active_people_with_same_email > 1 THEN 'email_ambigua'
      WHEN people_with_same_email > 0 THEN 'solo_persone_non_attive'
      ELSE 'nessuna_persona_corrispondente'
    END AS classification
  FROM matches
)
SELECT
  'T2_auth_profiles_without_profile_breakdown' AS check_id,
  jsonb_build_object(
    'totale', (SELECT count(*) FROM classified),
    'collegabili_automaticamente', (SELECT count(*) FROM classified WHERE classification = 'collegabile_automaticamente'),
    'nessuna_persona_corrispondente', (SELECT count(*) FROM classified WHERE classification = 'nessuna_persona_corrispondente'),
    'email_ambigua', (SELECT count(*) FROM classified WHERE classification = 'email_ambigua'),
    'solo_persone_non_attive', (SELECT count(*) FROM classified WHERE classification = 'solo_persone_non_attive'),
    'senza_email', (SELECT count(*) FROM classified WHERE classification = 'senza_email')
  ) AS riepilogo,
  jsonb_build_object(
    'collegabili_automaticamente', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sample.id, 'email', sample.email) ORDER BY sample.email)
      FROM (
        SELECT id, email
        FROM classified
        WHERE classification = 'collegabile_automaticamente'
        ORDER BY email
        LIMIT 10
      ) sample
    ), '[]'::jsonb),
    'nessuna_persona_corrispondente', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', sample.id, 'email', sample.email) ORDER BY sample.email)
      FROM (
        SELECT id, email
        FROM classified
        WHERE classification = 'nessuna_persona_corrispondente'
        ORDER BY email
        LIMIT 10
      ) sample
    ), '[]'::jsonb)
  ) AS esempi;
