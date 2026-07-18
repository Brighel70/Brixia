-- Cerca il codice TeamFlow (e email) di Andrea Bulgari
-- Esegui in Supabase → SQL Editor

SELECT
  id,
  given_name,
  family_name,
  full_name,
  email,
  invite_code_teamflow AS codice_teamflow,
  invite_code AS codice_flowme
FROM public.people
WHERE (given_name ILIKE '%Andrea%' AND family_name ILIKE '%Bulgari%')
   OR full_name ILIKE '%Andrea%Bulgari%'
   OR full_name ILIKE '%Bulgari%Andrea%';
