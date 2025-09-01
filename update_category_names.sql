-- Aggiorna i nomi delle categorie
-- Esegui questo script nel tuo database Supabase

-- Aggiorna "Cadetta" in "Serie C"
UPDATE public.categories 
SET name = 'Serie C' 
WHERE code = 'CADETTA';

-- Aggiorna "Prima Squadra" in "Serie B"
UPDATE public.categories 
SET name = 'Serie B' 
WHERE code = 'PRIMA';

-- Verifica le modifiche
SELECT code, name, active, sort 
FROM public.categories 
WHERE code IN ('CADETTA', 'PRIMA') 
ORDER BY sort;

