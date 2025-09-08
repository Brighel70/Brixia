-- Script per disabilitare COMPLETAMENTE RLS e risolvere tutti i problemi

-- 1. DISABILITA RLS SU TUTTE LE TABELLE
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI TUTTE LE POLITICHE ESISTENTI SU PROFILES
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profili gestibili da utente autenticato" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_none" ON public.profiles;

-- 3. RIMUOVI TUTTE LE POLITICHE SU STAFF_CATEGORIES
DROP POLICY IF EXISTS "staff_categories_select_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "staff_categories_insert_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "staff_categories_update_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "staff_categories_delete_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "Allow authenticated users to manage staff categories" ON public.staff_categories;
DROP POLICY IF EXISTS "Allow admins to manage all staff categories" ON public.staff_categories;

-- 4. RIMUOVI TUTTE LE POLITICHE SU USER_ROLES
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;

-- 5. RIMUOVI TUTTE LE POLITICHE SU CATEGORIES
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

-- 6. VERIFICA CHE RLS SIA DISABILITATO
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'staff_categories', 'user_roles', 'categories')
  AND schemaname = 'public';

-- 7. VERIFICA CHE NON CI SIANO POLITICHE
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('profiles', 'staff_categories', 'user_roles', 'categories')
  AND schemaname = 'public';

-- 8. MESSAGGIO DI CONFERMA
SELECT 'RLS disabilitato COMPLETAMENTE su tutte le tabelle!' as status;
SELECT 'Ora dovresti poter creare utenti e caricare lo staff senza errori!' as next_step;









