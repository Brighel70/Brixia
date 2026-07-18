-- FORZA l'aggiornamento del constraint fees_category_check
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima controlla lo stato attuale
SELECT 'BEFORE UPDATE - Current constraint:' as status;
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 2. Controlla le categorie esistenti
SELECT 'BEFORE UPDATE - Existing categories:' as status;
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 3. RIMUOVI il constraint esistente (se esiste)
ALTER TABLE public.fees DROP CONSTRAINT IF EXISTS fees_category_check;

-- 4. AGGIUNGI il nuovo constraint con tutte le categorie Brixia
ALTER TABLE public.fees ADD CONSTRAINT fees_category_check 
CHECK (category IN (
  'all', 
  'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 
  'SERIE_C', 'SERIE_B', 'SENIORES', 
  'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE'
));

-- 5. Verifica che il constraint sia stato aggiunto
SELECT 'AFTER UPDATE - New constraint:' as status;
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 6. Testa con una categoria valida
SELECT 'TESTING - Inserting test fee:' as status;
INSERT INTO public.fees (name, type, amount, category) 
VALUES ('Test Quota U14', 'membership', 1000, 'U14')
ON CONFLICT DO NOTHING;

-- 7. Verifica che l'inserimento sia riuscito
SELECT 'TESTING - Checking test fee:' as status;
SELECT * FROM public.fees WHERE name = 'Test Quota U14';

-- 8. Rimuovi la quota di test
DELETE FROM public.fees WHERE name = 'Test Quota U14';

-- 9. Risultato finale
SELECT 'CONSTRAINT UPDATE COMPLETED SUCCESSFULLY!' as status;
