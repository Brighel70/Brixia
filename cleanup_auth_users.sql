-- Script per pulire auth.users da utenti non confermati
-- ATTENZIONE: Questo script elimina TUTTI gli utenti non confermati

-- 1. Prima vediamo quanti utenti non confermati ci sono
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    CASE 
        WHEN email_confirmed_at IS NULL THEN 'NON CONFERMATO'
        ELSE 'CONFERMATO'
    END as status
FROM auth.users 
WHERE email_confirmed_at IS NULL;

-- 2. Elimina tutti gli utenti non confermati
-- ATTENZIONE: Questo è irreversibile!
DELETE FROM auth.users 
WHERE email_confirmed_at IS NULL;

-- 3. Verifica che siano stati eliminati
SELECT COUNT(*) as utenti_rimanenti
FROM auth.users;

-- 4. Mostra gli utenti rimanenti (solo quelli confermati)
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
ORDER BY created_at DESC;


