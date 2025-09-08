-- Verifica se la tabella player_positions esiste e ha dati
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_positions') 
    THEN 'Tabella player_positions esiste'
    ELSE 'Tabella player_positions NON esiste'
  END as table_status;

-- Se esiste, mostra i dati
SELECT 'Dati in player_positions:' as info, name, position_order
FROM public.player_positions
ORDER BY position_order;



