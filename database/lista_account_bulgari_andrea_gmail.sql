-- 1) ELENCO: tutti gli account con email bulgari.andrea@gmail.com
-- Esegui in Supabase → SQL Editor per vedere cosa c'è prima di eliminare

-- A) Persone (people) con questa email
SELECT 'people' AS tabella, id, full_name, given_name, family_name, email, invite_code_teamflow
FROM public.people
WHERE email ILIKE 'bulgari.andrea@gmail.com';

-- B) Profili (profiles) con questa email + indicazione se è quello da tenere (Andrea Bulgari)
WITH persona_andrea AS (
  SELECT id AS persona_id
  FROM public.people
  WHERE email ILIKE 'bulgari.andrea@gmail.com'
    AND ( (given_name ILIKE '%Andrea%' AND family_name ILIKE '%Bulgari%')
          OR full_name ILIKE '%Andrea%Bulgari%' )
  LIMIT 1
)
SELECT
  p.id AS profile_id,
  p.email,
  p.first_name,
  p.last_name,
  p.role,
  p.person_id,
  CASE WHEN p.person_id = (SELECT persona_id FROM persona_andrea) THEN 'DA TENERE (Andrea Bulgari)' ELSE 'DA ELIMINARE' END AS azione
FROM public.profiles p
WHERE p.email ILIKE 'bulgari.andrea@gmail.com';

-- C) Se non c’è nessuna persona "Andrea Bulgari" con questa email, il primo SELECT sopra sarà vuoto:
--    in quel caso nessun profilo è “da tenere” e puoi eliminarli tutti con lo script di eliminazione.
