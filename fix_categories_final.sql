-- Sistema le categorie e aggiungi Prima Squadra
-- Esegui questo script nel tuo database Supabase

-- 1. Rimuovi la categoria CADETTA che non è standard
DELETE FROM public.categories WHERE code = 'CADETTA';

-- 2. Aggiungi la categoria Prima Squadra
INSERT INTO public.categories (id, code, name, active, sort) VALUES
  (gen_random_uuid(), 'PRIMA', 'Prima Squadra', true, 8)
ON CONFLICT (code) DO NOTHING;

-- 3. Sistema l'ordine delle categorie
UPDATE public.categories SET sort = 7 WHERE code = 'U18';
UPDATE public.categories SET sort = 8 WHERE code = 'PRIMA';
UPDATE public.categories SET sort = 9 WHERE code = 'SENIORES';
UPDATE public.categories SET sort = 10 WHERE code = 'PODEROSA';
UPDATE public.categories SET sort = 11 WHERE code = 'GUSSAGOLD';
UPDATE public.categories SET sort = 12 WHERE code = 'BRIXIAOLD';
UPDATE public.categories SET sort = 13 WHERE code = 'LEONESSE';

-- 4. Attiva tutte le categorie principali
UPDATE public.categories 
SET active = true 
WHERE code IN ('U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'PRIMA', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE');

-- 5. Verifica il risultato finale
SELECT code, name, active, sort FROM categories ORDER BY sort;

