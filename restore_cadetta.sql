-- Ripristina CADETTA con ordine corretto
-- Esegui questo script nel tuo database Supabase

-- 1. Ripristina CADETTA
INSERT INTO public.categories (id, code, name, active, sort) VALUES
  (gen_random_uuid(), 'CADETTA', 'Cadetta', true, 8)
ON CONFLICT (code) DO NOTHING;

-- 2. Sistema l'ordine corretto (U18 prima di CADETTA)
UPDATE public.categories SET sort = 7 WHERE code = 'U18';
UPDATE public.categories SET sort = 8 WHERE code = 'CADETTA';
UPDATE public.categories SET sort = 9 WHERE code = 'PRIMA';
UPDATE public.categories SET sort = 10 WHERE code = 'SENIORES';
UPDATE public.categories SET sort = 11 WHERE code = 'PODEROSA';
UPDATE public.categories SET sort = 12 WHERE code = 'GUSSAGOLD';
UPDATE public.categories SET sort = 13 WHERE code = 'BRIXIAOLD';
UPDATE public.categories SET sort = 14 WHERE code = 'LEONESSE';

-- 3. Attiva tutte le categorie principali
UPDATE public.categories 
SET active = true 
WHERE code IN ('U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'CADETTA', 'PRIMA', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE');

-- 4. Verifica il risultato finale
SELECT code, name, active, sort FROM categories ORDER BY sort;

