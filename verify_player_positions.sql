-- Verifica che la tabella player_positions esista e abbia dati
SELECT 'Verifica tabella player_positions:' as info;

-- Conta i record
SELECT COUNT(*) as total_positions FROM public.player_positions;

-- Mostra tutti i dati
SELECT id, name, position_order, created_at 
FROM public.player_positions 
ORDER BY position_order;

-- Verifica la struttura della tabella
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'player_positions' 
ORDER BY ordinal_position;




