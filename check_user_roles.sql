-- Script per verificare lo stato della tabella user_roles
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica se la tabella user_roles esiste
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_roles';

-- 2. Conta i record nella tabella user_roles
SELECT COUNT(*) as total_roles FROM public.user_roles;

-- 3. Mostra tutti i ruoli esistenti (se ce ne sono)
SELECT 
  id,
  name,
  position_order,
  created_at
FROM public.user_roles 
ORDER BY position_order;

-- 4. Verifica le politiche RLS
SELECT 
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'user_roles';

