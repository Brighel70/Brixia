-- Script per correggere il vincolo di chiave esterna della tabella profiles
-- Il problema è che profiles.id NON ha un vincolo che punta a auth.users

-- 1. Prima vediamo i vincoli attuali (solo per conferma)
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'profiles';

-- 2. Rimuovi il vincolo esistente (che punta alla tabella sbagliata)
-- ATTENZIONE: Questo rimuove il vincolo esistente
ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;

-- 3. Ricrea il vincolo che punta alla tabella corretta (auth.users)
-- ATTENZIONE: Questo crea il vincolo corretto
ALTER TABLE profiles 
ADD CONSTRAINT profiles_id_fkey 
FOREIGN KEY (id) REFERENCES auth.users(id);

-- 4. Verifica che il vincolo sia stato creato correttamente
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'profiles';

-- 5. Ora dovresti vedere DUE vincoli:
-- - profiles_id_fkey: id -> auth.users(id) ← CORRETTO!
-- - profiles_user_role_id_fkey: user_role_id -> user_roles(id) ← GIA' ESISTENTE
