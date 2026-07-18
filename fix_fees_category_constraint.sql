-- Fix per il constraint delle categorie nella tabella fees
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Rimuovi il vecchio constraint
ALTER TABLE public.fees DROP CONSTRAINT IF EXISTS fees_category_check;

-- 2. Aggiungi il nuovo constraint con le categorie reali di Brixia Rugby
ALTER TABLE public.fees ADD CONSTRAINT fees_category_check 
CHECK (category IN ('all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SERIE_C', 'SERIE_B', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'));

-- 3. Verifica che il constraint sia stato applicato correttamente
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'fees_category_check';



