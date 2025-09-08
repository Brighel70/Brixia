-- STEP G: Lega eventuali account (profiles) alle persone
-- Migrazione sicura per Supabase - Non elimina nulla esistente

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id);

-- Backfill soft: crea una people per chi ha un profilo senza corrispondente
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email, phone)
SELECT
  COALESCE(NULLIF(TRIM(pr.first_name||' '||pr.last_name),''), pr.full_name, 'Senza Nome'),
  pr.first_name, 
  pr.last_name,
  COALESCE(pr.birth_date, to_date(NULLIF(pr.birth_year::text,''),'YYYY')),
  pr.email, 
  pr.phone
FROM public.profiles pr
LEFT JOIN public.people pe ON pe.id = pr.person_id
WHERE pr.person_id IS NULL;

UPDATE public.profiles pr
SET person_id = pe.id
FROM public.people pe
WHERE pr.person_id IS NULL
  AND pe.email IS NOT DISTINCT FROM pr.email
  AND (pe.given_name IS NOT DISTINCT FROM pr.first_name OR pr.first_name IS NULL)
  AND (pe.family_name IS NOT DISTINCT FROM pr.last_name OR pr.last_name IS NULL);





