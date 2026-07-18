-- Controlla lo stato attuale del constraint fees_category_check
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Controlla il constraint attuale
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 2. Controlla le categorie esistenti nella tabella
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 3. Prova a inserire una categoria valida per test
-- (Questo dovrebbe funzionare se il constraint è corretto)
INSERT INTO public.fees (name, type, amount, category) 
VALUES ('Test Quota', 'membership', 1000, 'U14')
ON CONFLICT DO NOTHING;

-- 4. Rimuovi la quota di test
DELETE FROM public.fees WHERE name = 'Test Quota';

-- 5. Mostra il risultato
SELECT 'Constraint check completed' as status;



