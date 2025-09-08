-- =====================================================
-- FIX: Gestione date di nascita mancanti
-- =====================================================

-- 1. Prima controlla quanti players hanno date di nascita mancanti
SELECT 
  'Players con birth_date NULL' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE birth_date IS NULL AND birth_year IS NULL

UNION ALL

SELECT 
  'Players con birth_date presente' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE birth_date IS NOT NULL

UNION ALL

SELECT 
  'Players con solo birth_year' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE birth_date IS NULL AND birth_year IS NOT NULL;

-- 2. Aggiorna la tabella people per gestire i casi con date mancanti
-- Opzione A: Usa una data di default per i casi senza data
UPDATE public.people 
SET date_of_birth = '1900-01-01'  -- Data di default per casi senza data
WHERE date_of_birth IS NULL;

-- 3. Oppure Opzione B: Elimina i record problematici e ricrea solo quelli validi
-- (Commenta la sezione sopra e decommenta questa sezione se preferisci)

/*
-- Elimina i record people creati con date NULL
DELETE FROM public.people 
WHERE date_of_birth IS NULL;

-- Ricrea solo i players con date valide
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email, phone, nationality)
SELECT
  COALESCE(NULLIF(TRIM(p.first_name||' '||p.last_name),''), 'Senza Nome'),
  NULLIF(p.first_name,''),
  NULLIF(p.last_name,''),
  COALESCE(p.birth_date, to_date(p.birth_year::text || '-01-01','YYYY-MM-DD')),
  NULL, NULL, NULL
FROM public.players p
WHERE p.person_id IS NULL
  AND (p.birth_date IS NOT NULL OR p.birth_year IS NOT NULL);

-- Aggiorna i players con le people valide
UPDATE public.players pl
SET person_id = pe.id
FROM public.people pe
WHERE pl.person_id IS NULL
  AND pe.given_name IS NOT DISTINCT FROM pl.first_name
  AND pe.family_name IS NOT DISTINCT FROM pl.last_name
  AND pe.date_of_birth IS NOT DISTINCT FROM COALESCE(pl.birth_date, to_date(pl.birth_year::text||'-01-01','YYYY-MM-DD'));
*/

-- 4. Verifica il risultato
SELECT 
  'People create con successo' as descrizione,
  COUNT(*) as totale
FROM public.people

UNION ALL

SELECT 
  'Players collegati a people' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE person_id IS NOT NULL

UNION ALL

SELECT 
  'Players ancora senza person_id' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE person_id IS NULL;

-- 5. Mostra i dettagli dei players senza person_id (se ce ne sono)
SELECT 
  id,
  first_name,
  last_name,
  birth_date,
  birth_year,
  fir_code
FROM public.players 
WHERE person_id IS NULL
LIMIT 10;





