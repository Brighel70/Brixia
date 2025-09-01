-- Pulisci le categorie duplicate e correggi i nomi
-- Prima elimina le categorie duplicate con nomi sbagliati

-- Elimina le categorie con nomi sbagliati
DELETE FROM public.categories WHERE code IN (
  'Under 14', 'Under 16', 'Under 18', 'Cadetta', 'Prima Squadra', 'Seniores'
);

-- Mantieni solo le categorie corrette
-- Verifica il risultato
SELECT code, name, active FROM categories ORDER BY sort;

-- Aggiorna tutte le categorie corrette per essere attive
UPDATE public.categories 
SET active = true 
WHERE code IN ('U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE');

-- Verifica finale
SELECT code, name, active FROM categories ORDER BY sort;

