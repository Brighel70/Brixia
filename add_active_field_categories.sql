-- Aggiungi campo active alla tabella categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false;

-- Aggiorna le categorie esistenti per renderle attive
UPDATE public.categories 
SET active = true 
WHERE code IN ('U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE');

-- Verifica la struttura aggiornata
SELECT code, name, active FROM categories ORDER BY sort;

