-- STEP B: Collega players alla persona
-- Migrazione sicura per Supabase - Non elimina nulla esistente

-- 1) Aggiungi FK a people
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS person_id uuid;

ALTER TABLE public.players
  ADD CONSTRAINT players_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;

-- 2) Backfill: crea una persona per ogni player (una-tantum)
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email, phone, nationality)
SELECT
  COALESCE(NULLIF(TRIM(p.first_name||' '||p.last_name),''), 'Senza Nome'),
  NULLIF(p.first_name,''),
  NULLIF(p.last_name,''),
  COALESCE(p.birth_date, to_date(p.birth_year::text || '-01-01','YYYY-MM-DD')),
  NULL, NULL, NULL
FROM public.players p
LEFT JOIN public.people pe ON false
-- filtra solo chi non ha ancora person_id
WHERE p.person_id IS NULL;

-- 3) Aggancia i players alle people appena create (per nome+cognome+data)
UPDATE public.players pl
SET person_id = pe.id
FROM public.people pe
WHERE pl.person_id IS NULL
  AND pe.given_name IS NOT DISTINCT FROM pl.first_name
  AND pe.family_name IS NOT DISTINCT FROM pl.last_name
  AND pe.date_of_birth IS NOT DISTINCT FROM COALESCE(pl.birth_date, to_date(pl.birth_year::text||'-01-01','YYYY-MM-DD'));

-- Check: select count(*) from players where person_id is null; 
-- → deve andare a 0 (o pochi casi da sistemare manualmente)





