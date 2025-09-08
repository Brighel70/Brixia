-- Disabilita RLS sulla tabella player_positions
ALTER TABLE player_positions DISABLE ROW LEVEL SECURITY;

-- Rimuovi tutte le policy esistenti (se ce ne sono)
DROP POLICY IF EXISTS "Enable read access for all users" ON player_positions;
DROP POLICY IF EXISTS "Enable insert for all users" ON player_positions;
DROP POLICY IF EXISTS "Enable update for all users" ON player_positions;
DROP POLICY IF EXISTS "Enable delete for all users" ON player_positions;

-- Verifica che RLS sia disabilitato
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'player_positions';



