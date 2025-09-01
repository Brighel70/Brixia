-- Aggiorna codici e nomi delle categorie
-- Esegui questo script nel tuo database Supabase

-- Aggiorna "CADETTA" in "SERIE_C"
UPDATE public.categories 
SET code = 'SERIE_C', name = 'Serie C' 
WHERE code = 'CADETTA';

-- Aggiorna "PRIMA" in "SERIE_B"
UPDATE public.categories 
SET code = 'SERIE_B', name = 'Serie B' 
WHERE code = 'PRIMA';

-- Verifica le modifiche
SELECT code, name, active, sort 
FROM public.categories 
WHERE code IN ('SERIE_C', 'SERIE_B') 
ORDER BY sort;

