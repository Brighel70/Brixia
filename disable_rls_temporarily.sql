RICONTROLLA UN ATTIMO TUTTO IL DATABASE PER CAPIRE SE STAI FACENDO LE COSE GIUSTE:



-- 1. DISABILITA RLS SU TUTTE LE TABELLE PROBLEMATICHE
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_categories DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI TUTTE LE POLITICHE ESISTENTI
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

-- Rimuovi politiche da staff_categories
DROP POLICY IF EXISTS "staff_categories_select_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "staff_categories_insert_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "staff_categories_update_policy" ON public.staff_categories;
DROP POLICY IF EXISTS "staff_categories_delete_policy" ON public.staff_categories;

-- 3. VERIFICA CHE RLS SIA DISABILITATO
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'staff_categories')
  AND schemaname = 'public';

-- 4. VERIFICA CHE NON CI SIANO POLITICHE
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('profiles', 'staff_categories')
  AND schemaname = 'public';

-- 5. MESSAGGIO DI CONFERMA
SELECT 'RLS disabilitato temporaneamente su profiles e staff_categories!' as status;
SELECT 'Ora dovresti poter creare utenti e caricare lo staff senza errori!' as next_step;
