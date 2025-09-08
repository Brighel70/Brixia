-- Script per configurare le politiche RLS per la tabella user_roles
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Abilita RLS sulla tabella user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Crea politica per permettere la lettura a tutti gli utenti autenticati
CREATE POLICY "Ruoli utenti visibili a tutti gli autenticati" ON public.user_roles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Crea politica per permettere la modifica solo agli admin
CREATE POLICY "Solo admin possono modificare ruoli utenti" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 4. Verifica le politiche create
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'user_roles';


