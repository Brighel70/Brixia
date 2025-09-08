-- Script per risolvere la ricorsione infinita nelle politiche RLS

-- 1. RIMUOVI TUTTE LE POLITICHE ESISTENTI
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profili gestibili da utente autenticato" ON public.profiles;

-- 2. CREA POLITICHE SEMPLICI SENZA RICORSIONE
-- Politica per SELECT: tutti gli utenti autenticati possono leggere
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Politica per INSERT: tutti gli utenti autenticati possono inserire
CREATE POLICY "profiles_insert_policy" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Politica per UPDATE: solo il proprio profilo
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Politica per DELETE: solo admin (senza ricorsione)
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (false); -- Disabilita delete per ora

-- 3. VERIFICA LE NUOVE POLITICHE
SELECT 
  policyname,
  cmd,
  permissive,
  roles
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;








