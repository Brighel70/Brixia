-- Script per rimuovere i ruoli duplicati e mantenere solo quelli italiani
-- Esegui questo script nel SQL Editor di Supabase

-- 1. DISABILITA RLS sulla tabella user_roles (se non già fatto)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI I RUOLI DUPLICATI IN INGLESE
DELETE FROM public.user_roles WHERE name = 'Coach';
DELETE FROM public.user_roles WHERE name = 'Medic';
DELETE FROM public.user_roles WHERE name = 'Director';
DELETE FROM public.user_roles WHERE name = 'Staff';
DELETE FROM public.user_roles WHERE name = 'Player';

-- 3. VERIFICA I RUOLI RIMANENTI
SELECT 'Ruoli finali (solo italiani):' as info, name, position_order 
FROM public.user_roles 
ORDER BY position_order;

-- 4. MESSAGGIO DI CONFERMA
SELECT '✅ Ruoli duplicati rimossi! Ora hai solo i ruoli in italiano.' as status;



