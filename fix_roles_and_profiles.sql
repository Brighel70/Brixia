-- Script per rimuovere i ruoli duplicati aggiornando prima i profili
-- Esegui questo script nel SQL Editor di Supabase

-- 1. DISABILITA RLS sulla tabella user_roles
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 2. AGGIORNA I PROFILI PER USARE I RUOLI ITALIANI
-- Coach -> Allenatore
UPDATE public.profiles 
SET user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Allenatore')
WHERE user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Coach');

-- Medic -> Medico  
UPDATE public.profiles 
SET user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Medico')
WHERE user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Medic');

-- Director -> Dirigente
UPDATE public.profiles 
SET user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Dirigente')
WHERE user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Director');

-- Staff -> Segreteria
UPDATE public.profiles 
SET user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Segreteria')
WHERE user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Staff');

-- Player -> Giocatore
UPDATE public.profiles 
SET user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Giocatore')
WHERE user_role_id = (SELECT id FROM public.user_roles WHERE name = 'Player');

-- 3. ORA PUOI CANCELLARE I RUOLI DUPLICATI
DELETE FROM public.user_roles WHERE name = 'Coach';
DELETE FROM public.user_roles WHERE name = 'Medic';
DELETE FROM public.user_roles WHERE name = 'Director';
DELETE FROM public.user_roles WHERE name = 'Staff';
DELETE FROM public.user_roles WHERE name = 'Player';

-- 4. VERIFICA I RUOLI FINALI
SELECT 'Ruoli finali (solo italiani):' as info, name, position_order 
FROM public.user_roles 
ORDER BY position_order;

-- 5. VERIFICA I PROFILI AGGIORNATI
SELECT 'Profili aggiornati:' as info, p.full_name, ur.name as ruolo
FROM public.profiles p
JOIN public.user_roles ur ON p.user_role_id = ur.id
ORDER BY p.full_name;

-- 6. MESSAGGIO DI CONFERMA
SELECT '✅ Ruoli duplicati rimossi e profili aggiornati!' as status;



