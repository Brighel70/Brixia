-- Script per verificare la struttura della tabella players
-- Esegui questo nel tuo database Supabase per vedere i campi disponibili

-- 1. Verifica la struttura della tabella players
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'players'
ORDER BY ordinal_position;

-- 2. Verifica se esiste la tabella players
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'players'
) as players_table_exists;

-- 3. Se la tabella esiste, mostra alcuni dati di esempio
SELECT * FROM players LIMIT 3;

-- 4. Verifica anche la tabella profiles
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;


