-- Cerca account/registrazioni con questa email
-- (Hai scritto bulgari.andrea@gmail.co – se intendi .com cambia sotto)
-- Esegui in Supabase → SQL Editor

-- 1. Nella tabella people (scheda persona)
SELECT 'people' AS tabella, id, email, full_name, invite_code_teamflow, invite_code
FROM public.people
WHERE email ILIKE 'bulgari.andrea@gmail.co%';

-- 2. Nella tabella profiles (account login collegati)
SELECT 'profiles' AS tabella, id, email, first_name, last_name, role, person_id
FROM public.profiles
WHERE email ILIKE 'bulgari.andrea@gmail.co%';

-- 3. In auth.users (solo se hai permessi su schema auth – altrimenti vedi utenti in Dashboard → Authentication → Users)
-- SELECT id, email, created_at, email_confirmed_at
-- FROM auth.users
-- WHERE email ILIKE 'bulgari.andrea@gmail.co%';
