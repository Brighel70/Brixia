-- Script per popolare le posizioni dei giocatori nella tabella roles

-- 1. Inserisci le posizioni dei giocatori di rugby
INSERT INTO public.roles (name, position_order) VALUES
('Pilone', 1),
('Tallonatore', 2), 
('Seconda Linea', 3),
('Terza Linea', 4),
('Mediano di Mischia', 5),
('Mediano d''Apertura', 6),
('Centro', 7),
('Ala', 8),
('Estremo', 9)
ON CONFLICT (name) DO NOTHING;

-- 2. Verifica che i dati siano stati inseriti
SELECT 'Posizioni giocatori inserite:' as info, name, position_order
FROM public.roles
ORDER BY position_order;



