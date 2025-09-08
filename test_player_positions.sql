-- Test per verificare la tabella player_positions
SELECT 'Verifica tabella player_positions' as test;

-- Conta i record
SELECT 'Conteggio record:' as info, count(*) as count FROM player_positions;

-- Mostra tutti i record
SELECT 'Tutti i record:' as info, id, name, position_order FROM player_positions ORDER BY position_order;

-- Test di accesso diretto
SELECT 'Test accesso diretto:' as info, name FROM player_positions WHERE name = 'Pilone DX';




