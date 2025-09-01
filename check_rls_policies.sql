-- Verifica le policy RLS sulla tabella categories
-- Esegui questo script nel tuo database Supabase

-- 1. Verifica se RLS è abilitato
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'categories';

-- 2. Verifica le policy esistenti
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'categories';

-- 3. Test di update diretto
UPDATE public.categories 
SET active = false 
WHERE code = 'U6' 
RETURNING id, code, active;

-- 4. Verifica il risultato
SELECT code, active FROM categories WHERE code = 'U6';

