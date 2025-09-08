-- Script per aggiungere le politiche RLS mancanti per la tabella profiles

-- 1. Politica per SELECT: permette agli utenti autenticati di leggere i profili
CREATE POLICY "Allow authenticated users to read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- 2. Politica per INSERT: permette agli utenti autenticati di inserire nuovi profili
CREATE POLICY "Allow authenticated users to insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Politica per UPDATE: permette agli utenti di aggiornare il proprio profilo
CREATE POLICY "Allow users to update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Politica per DELETE: permette agli admin di eliminare profili
CREATE POLICY "Allow admins to delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- 5. Politica speciale per admin: permette agli admin di fare tutto
CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Verifica che le politiche siano state create
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
WHERE tablename = 'profiles'
ORDER BY policyname;








