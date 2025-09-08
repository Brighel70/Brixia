-- Verifica la struttura della tabella players
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'players' 
ORDER BY ordinal_position;




