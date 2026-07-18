-- FIX COMPLETO: Aggiorna TUTTE le categorie esistenti
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima mostra TUTTE le categorie esistenti
SELECT 'BEFORE FIX - All existing categories:' as status;
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 2. Mostra le righe che potrebbero causare problemi
SELECT 'Problematic rows (if any):' as status;
SELECT id, name, category, type
FROM public.fees 
WHERE category NOT IN (
  'all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 
  'SERIE_C', 'SERIE_B', 'SENIORES', 
  'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'
);

-- 3. RIMUOVI il constraint temporaneamente
ALTER TABLE public.fees DROP CONSTRAINT IF EXISTS fees_category_check;

-- 4. Aggiorna TUTTE le categorie problematiche
UPDATE public.fees 
SET category = CASE 
  WHEN category = 'adult' THEN 'SENIORES'
  WHEN category = 'youth' THEN 'U18'
  WHEN category = 'senior' THEN 'SENIORES'
  WHEN category = 'family' THEN 'all'
  WHEN category = 'child' THEN 'U12'
  WHEN category = 'teen' THEN 'U16'
  WHEN category = 'junior' THEN 'U14'
  WHEN category = 'senior' THEN 'SENIORES'
  WHEN category = 'adults' THEN 'SENIORES'
  WHEN category = 'youths' THEN 'U18'
  WHEN category = 'children' THEN 'U12'
  WHEN category = 'teens' THEN 'U16'
  WHEN category = 'juniors' THEN 'U14'
  WHEN category = 'seniors' THEN 'SENIORES'
  WHEN category = 'families' THEN 'all'
  WHEN category = 'all_ages' THEN 'all'
  WHEN category = 'mixed' THEN 'all'
  WHEN category = 'general' THEN 'all'
  WHEN category = 'default' THEN 'all'
  WHEN category = '' THEN 'all'
  WHEN category IS NULL THEN 'all'
  ELSE 'all'  -- Default per QUALSIASI altra categoria sconosciuta
END
WHERE category NOT IN (
  'all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 
  'SERIE_C', 'SERIE_B', 'SENIORES', 
  'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'
);

-- 5. Verifica le categorie dopo l'aggiornamento
SELECT 'AFTER UPDATE - Updated categories:' as status;
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 6. AGGIUNGI il nuovo constraint
ALTER TABLE public.fees ADD CONSTRAINT fees_category_check 
CHECK (category IN (
  'all', 
  'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 
  'SERIE_C', 'SERIE_B', 'SENIORES', 
  'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'
));

-- 7. Verifica che il constraint sia stato aggiunto
SELECT 'AFTER CONSTRAINT - New constraint:' as status;
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 8. Testa con una categoria valida
SELECT 'TESTING - Inserting test fee:' as status;
INSERT INTO public.fees (name, type, amount, category) 
VALUES ('Test Quota U14', 'membership', 1000, 'U14')
ON CONFLICT DO NOTHING;

-- 9. Verifica che l'inserimento sia riuscito
SELECT 'TESTING - Checking test fee:' as status;
SELECT * FROM public.fees WHERE name = 'Test Quota U14';

-- 10. Rimuovi la quota di test
DELETE FROM public.fees WHERE name = 'Test Quota U14';

-- 11. Risultato finale
SELECT 'ALL CATEGORIES FIXED SUCCESSFULLY!' as status;



