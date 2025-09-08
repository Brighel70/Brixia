-- Script per popolare la tabella player_positions con i dati corretti

-- 1. Pulisci la tabella (opzionale, se vuoi ricominciare da zero)
-- DELETE FROM public.player_positions;

-- 2. Inserisci le posizioni dei giocatori di rugby
INSERT INTO public.player_positions (name, position_order) VALUES
('Pilone DX', 1),
('Pilone SX', 2),
('Tallonatore', 3),
('Seconda Linea', 4),
('Terza Linea', 5),
('Mediano di Mischia', 6),
('Mediano d''Apertura', 7),
('Centro', 8),
('Ala', 9),
('Estremo', 10)
ON CONFLICT (name) DO NOTHING;

-- 3. Verifica che i dati siano stati inseriti
SELECT 'Posizioni giocatori inserite:' as info, name, position_order
FROM public.player_positions
ORDER BY position_order;




