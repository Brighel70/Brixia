-- Elimina il profilo (Aaaa Bbbb, bulgari.andrea@gmail.com, role tutor)
-- Esegui in Supabase → SQL Editor

-- 1. Elimina dalla tabella profiles
DELETE FROM public.profiles
WHERE id = '7d6f572f-dd90-42fb-ad61-55c084e51269';

-- 2. Verifica che sia stato eliminato (deve restituire 0 righe)
SELECT COUNT(*) AS rimasti FROM public.profiles WHERE id = '7d6f572f-dd90-42fb-ad61-55c084e51269';

-- NOTA: L'utente in Supabase Auth (stesso id) resta. Per poter fare di nuovo login con email + codice TeamFlow
-- eliminalo anche da Dashboard → Authentication → Users → cerca bulgari.andrea@gmail.com → ⋮ → Delete user.
