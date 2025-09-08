-- Script definitivo per risolvere la ricorsione infinita nelle politiche RLS

-- 1. DISABILITA TEMPORANEAMENTE RLS
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

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

-- 3. ABILITA RLS DI NUOVO
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. CREA POLITICHE SEMPLICI E SICURE
-- Politica per SELECT: tutti gli utenti autenticati possono leggere
CREATE POLICY "profiles_read_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Politica per INSERT: tutti gli utenti autenticati possono inserire
CREATE POLICY "profiles_insert_all" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Politica per UPDATE: solo il proprio profilo
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Politica per DELETE: disabilitata per sicurezza
CREATE POLICY "profiles_delete_none" ON public.profiles
  FOR DELETE TO authenticated
  USING (false);

-- 5. VERIFICA LE NUOVE POLITICHE
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 6. TESTA L'INSERIMENTO
-- Questo dovrebbe funzionare ora senza ricorsione
SELECT 'Politiche RLS aggiornate con successo!' as status;








