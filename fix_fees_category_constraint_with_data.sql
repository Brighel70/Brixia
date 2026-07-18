-- Fix completo per il constraint delle categorie nella tabella fees
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima aggiorna i dati esistenti per mappare le vecchie categorie alle nuove
UPDATE public.fees 
SET category = CASE 
  WHEN category = 'adult' THEN 'SENIORES'
  WHEN category = 'youth' THEN 'U18'
  WHEN category = 'senior' THEN 'SENIORES'
  WHEN category = 'family' THEN 'all'
  WHEN category = 'all' THEN 'all'
  ELSE 'all'  -- Default per categorie sconosciute
END
WHERE category IN ('adult', 'youth', 'senior', 'family');

-- 2. Verifica i dati aggiornati
SELECT DISTINCT category FROM public.fees ORDER BY category;

-- 3. Rimuovi il vecchio constraint
ALTER TABLE public.fees DROP CONSTRAINT IF EXISTS fees_category_check;

-- 4. Aggiungi il nuovo constraint con le categorie reali di Brixia Rugby
ALTER TABLE public.fees ADD CONSTRAINT fees_category_check 
CHECK (category IN ('all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SERIE_C', 'SERIE_B', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'));

-- 5. Verifica che il constraint sia stato applicato correttamente
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 6. Test finale - verifica che tutte le categorie siano valide
SELECT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;



