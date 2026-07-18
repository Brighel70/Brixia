-- FIX: Aggiorna i dati esistenti e poi applica il constraint
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima controlla le categorie esistenti
SELECT 'BEFORE FIX - Existing categories:' as status;
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 2. Aggiorna le categorie esistenti per mapparle alle nuove categorie Brixia
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
  ELSE 'all'  -- Default per categorie sconosciute
END
WHERE category NOT IN (
  'all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 
  'SERIE_C', 'SERIE_B', 'SENIORES', 
  'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'
);

-- 3. Verifica le categorie dopo l'aggiornamento
SELECT 'AFTER UPDATE - Updated categories:' as status;
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 4. RIMUOVI il constraint esistente (se esiste)
ALTER TABLE public.fees DROP CONSTRAINT IF EXISTS fees_category_check;

-- 5. AGGIUNGI il nuovo constraint con tutte le categorie Brixia
ALTER TABLE public.fees ADD CONSTRAINT fees_category_check 
CHECK (category IN (
  'all', 
  'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 
  'SERIE_C', 'SERIE_B', 'SENIORES', 
  'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'
));

-- 6. Verifica che il constraint sia stato aggiunto
SELECT 'AFTER CONSTRAINT - New constraint:' as status;
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 7. Testa con una categoria valida
SELECT 'TESTING - Inserting test fee:' as status;
INSERT INTO public.fees (name, type, amount, category) 
VALUES ('Test Quota U14', 'membership', 1000, 'U14')
ON CONFLICT DO NOTHING;

-- 8. Verifica che l'inserimento sia riuscito
SELECT 'TESTING - Checking test fee:' as status;
SELECT * FROM public.fees WHERE name = 'Test Quota U14';

-- 9. Rimuovi la quota di test
DELETE FROM public.fees WHERE name = 'Test Quota U14';

-- 10. Risultato finale
SELECT 'DATA AND CONSTRAINT UPDATE COMPLETED SUCCESSFULLY!' as status;



