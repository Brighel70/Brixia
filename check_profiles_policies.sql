-- Script per verificare le politiche RLS della tabella profiles

-- 1. Controlla se RLS è abilitato
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles';

-- 2. Controlla le politiche esistenti
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

-- 3. Controlla se ci sono utenti nella tabella profiles
SELECT 
  COUNT(*) as total_profiles,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
  COUNT(CASE WHEN role = 'coach' THEN 1 END) as coach_count,
  COUNT(CASE WHEN role = 'medic' THEN 1 END) as medic_count,
  COUNT(CASE WHEN role = 'director' THEN 1 END) as director_count
FROM public.profiles;

-- 4. Controlla l'utente corrente
SELECT 
  auth.uid() as current_user_id,
  p.full_name,
  p.role,
  p.email
FROM public.profiles p
WHERE p.id = auth.uid();


