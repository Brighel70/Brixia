-- ========================================
-- INSERIMENTO CATEGORIE BRIXIA RUGBY
-- ========================================

-- Inserisci le categorie (ignora se già esistono)
INSERT INTO public.categories (code, name, sort) VALUES
  ('U6', 'Under 6', 1),
  ('U8', 'Under 8', 2),
  ('U10', 'Under 10', 3),
  ('U12', 'Under 12', 4),
  ('U14', 'Under 14', 5),
  ('U16', 'Under 16', 6),
  ('U18', 'Under 18', 7),
  ('SENIORES', 'Seniores', 8),
  ('PODEROSA', 'Poderosa', 9),
  ('GUSSAGOLD', 'GussagOld', 10),
  ('BRIXIAOLD', 'Brixia Old', 11),
  ('LEONESSE', 'Leonesse', 12)
ON CONFLICT (code) DO NOTHING;
