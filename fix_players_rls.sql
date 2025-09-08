-- Disabilita RLS sulla tabella players
ALTER TABLE players DISABLE ROW LEVEL SECURITY;

-- Rimuovi tutte le policy esistenti (se ce ne sono)
DROP POLICY IF EXISTS "Enable read access for all users" ON players;
DROP POLICY IF EXISTS "Enable insert for all users" ON players;
DROP POLICY IF EXISTS "Enable update for all users" ON players;
DROP POLICY IF EXISTS "Enable delete for all users" ON players;

-- Verifica che RLS sia disabilitato
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'players';




