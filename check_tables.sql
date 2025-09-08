-- Verifica le tabelle esistenti
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('roles', 'player_positions')
ORDER BY table_name;

-- Verifica la struttura della tabella roles
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'roles'
ORDER BY ordinal_position;

-- Verifica la struttura della tabella player_positions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'player_positions'
ORDER BY ordinal_position;

-- Verifica i dati esistenti
SELECT 'roles' as tabella, count(*) as count FROM roles
UNION ALL
SELECT 'player_positions' as tabella, count(*) as count FROM player_positions;




