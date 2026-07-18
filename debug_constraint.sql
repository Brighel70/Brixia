-- DEBUG: Controlla il constraint attuale
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Controlla il constraint attuale
SELECT 'Current constraint definition:' as status;
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conname = 'fees_category_check';

-- 2. Controlla le categorie esistenti
SELECT 'Existing categories:' as status;
SELECT DISTINCT category, COUNT(*) as count
FROM public.fees 
GROUP BY category 
ORDER BY category;

-- 3. Controlla se SENIORES è nel constraint
SELECT 'Checking if SENIORES is in constraint:' as status;
SELECT pg_get_constraintdef(oid) LIKE '%SENIORES%' as contains_seniores
FROM pg_constraint 
WHERE conname = 'fees_category_check';



