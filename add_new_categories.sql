-- ========================================
-- AGGIUNTA NUOVE CATEGORIE BRIXIA RUGBY
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase per aggiungere le nuove categorie

-- Inserisci le nuove categorie (ignora se già esistono)
INSERT INTO public.categories (code, name, sort) VALUES
  ('U6', 'Under 6', 1),
  ('CADETTA', 'Cadetta', 7),
  ('PODEROSA', 'Poderosa', 9),
  ('GUSSAGOLD', 'GussagOld', 10),
  ('BRIXIAOLD', 'Brixia Old', 11),
  ('LEONESSE', 'Leonesse', 12)
ON CONFLICT (code) DO NOTHING;

-- Aggiorna l'ordine delle categorie esistenti
UPDATE public.categories SET sort = 2 WHERE code = 'U8';
UPDATE public.categories SET sort = 3 WHERE code = 'U10';
UPDATE public.categories SET sort = 4 WHERE code = 'U12';
UPDATE public.categories SET sort = 5 WHERE code = 'U14';
UPDATE public.categories SET sort = 6 WHERE code = 'U16';
UPDATE public.categories SET sort = 7 WHERE code = 'U18';
UPDATE public.categories SET sort = 9 WHERE code = 'SENIORES';
UPDATE public.categories SET sort = 11 WHERE code = 'PODEROSA';
UPDATE public.categories SET sort = 12 WHERE code = 'GUSSAGOLD';
UPDATE public.categories SET sort = 13 WHERE code = 'BRIXIAOLD';
UPDATE public.categories SET sort = 14 WHERE code = 'LEONESSE';

-- Verifica le categorie
SELECT code, name, sort FROM public.categories ORDER BY sort;
