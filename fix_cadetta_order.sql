-- Corregge l'ordine: U18 prima di CADETTA
-- Esegui questo script nel tuo database Supabase

-- Sistema l'ordine corretto (U18 prima di CADETTA)
UPDATE public.categories SET sort = 7 WHERE code = 'U18';
UPDATE public.categories SET sort = 8 WHERE code = 'CADETTA';
UPDATE public.categories SET sort = 9 WHERE code = 'PRIMA';
UPDATE public.categories SET sort = 10 WHERE code = 'SENIORES';
UPDATE public.categories SET sort = 11 WHERE code = 'PODEROSA';
UPDATE public.categories SET sort = 12 WHERE code = 'GUSSAGOLD';
UPDATE public.categories SET sort = 13 WHERE code = 'BRIXIAOLD';
UPDATE public.categories SET sort = 14 WHERE code = 'LEONESSE';

-- Verifica il risultato finale
SELECT code, name, active, sort FROM categories ORDER BY sort;

