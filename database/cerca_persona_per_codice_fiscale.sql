-- Cerca se esiste già una persona con questo codice fiscale
-- Esegui in Supabase → SQL Editor (puoi sostituire il CF nella riga sotto)

-- Cerca (confronto case-insensitive, ignora spazi)
SELECT
  id,
  given_name,
  family_name,
  fiscal_code,
  email,
  phone,
  date_of_birth,
  status,
  created_at
FROM public.people
WHERE TRIM(LOWER(fiscal_code)) = TRIM(LOWER('GNNGPL72A26B157Y'));

-- Se vuoi solo sapere SE esiste (conteggio)
-- SELECT EXISTS (
--   SELECT 1 FROM public.people
--   WHERE TRIM(LOWER(fiscal_code)) = TRIM(LOWER('GNNGPL72A26B157Y'))
-- ) AS esiste;
