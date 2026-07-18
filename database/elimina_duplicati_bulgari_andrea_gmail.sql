-- 2) ELIMINA i profili duplicati con email bulgari.andrea@gmail.com
-- Tiene SOLO il profilo collegato alla persona "Andrea Bulgari" (person_id = quella persona).
-- Esegui in Supabase → SQL Editor.

-- Passo 1: Elimina da profiles tutti i profili con questa email TRANNE quello con person_id = Andrea Bulgari
DELETE FROM public.profiles
WHERE email ILIKE 'bulgari.andrea@gmail.com'
  AND person_id IS DISTINCT FROM (
    SELECT id FROM public.people
    WHERE email ILIKE 'bulgari.andrea@gmail.com'
      AND ( (given_name ILIKE '%Andrea%' AND family_name ILIKE '%Bulgari%')
            OR full_name ILIKE '%Andrea%Bulgari%' )
    LIMIT 1
  );

-- Se non esiste una persona "Andrea Bulgari" con questa email, il sotto-query è NULL
-- e vengono eliminati TUTTI i profili con questa email (nessuno ha person_id = NULL).
-- In quel caso dopo il login con email + codice TeamFlow si creerà di nuovo il profilo giusto.

-- Passo 2: (Opzionale) Se vuoi eliminare anche i profili dove person_id è NULL o diverso da Andrea Bulgari
-- già fatto sopra. Se invece vuoi tenere un solo profilo e cancellare tutti gli altri (anche quello “giusto”),
-- non usare questo script e scrivimi.

-- Passo 3: Verifica – deve restare al massimo 1 profilo con questa email
SELECT id, email, first_name, last_name, person_id
FROM public.profiles
WHERE email ILIKE 'bulgari.andrea@gmail.com';

-- IMPORTANTE: gli utenti in Supabase Auth (Authentication → Users) vanno eliminati a mano
-- per gli account che hai appena rimosso da profiles, altrimenti il login dirà ancora "email già registrata".
-- Vai in: Dashboard → Authentication → Users → cerca bulgari.andrea@gmail.com
-- Per ogni utente che NON deve più esistere: menu ⋮ → Delete user.
-- Tieni solo l’utente che corrisponde al profilo rimasto (stesso id del profilo).
