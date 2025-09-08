-- Script per risolvere il problema RLS della tabella user_roles
-- Esegui questo script nel SQL Editor di Supabase

-- 1. DISABILITA RLS sulla tabella user_roles
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI TUTTE LE POLITICHE ESISTENTI (se ce ne sono)
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;
DROP POLICY IF EXISTS "Allow authenticated users to read user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow all users to read user_roles" ON public.user_roles;

-- 3. VERIFICA CHE RLS SIA DISABILITATO
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_roles'
  AND schemaname = 'public';

-- 4. VERIFICA CHE NON CI SIANO POLITICHE
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename = 'user_roles'
  AND schemaname = 'public';

-- 5. TESTA L'ACCESSO AI RUOLI
SELECT 'Test accesso ruoli:' as info, name, position_order 
FROM public.user_roles 
ORDER BY position_order;

-- 6. MESSAGGIO DI CONFERMA
SELECT '✅ RLS disabilitato su user_roles! Ora dovresti vedere tutti i ruoli nella tendina!' as status;



