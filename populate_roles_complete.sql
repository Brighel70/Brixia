-- Script completo per popolare le tabelle roles e user_roles
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Inserisci ruoli giocatori (tabella roles)
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

-- 2. Inserisci ruoli staff (tabella user_roles)
INSERT INTO public.user_roles (name, position_order) VALUES 
('Admin', 1),
('Dirigente', 2),
('Segreteria', 3),
('Direttore Sportivo', 4),
('Direttore Tecnico', 5),
('Allenatore', 6),
('Team Manager', 7),
('Accompagnatore', 8),
('Player', 9),
('Preparatore', 10),
('Medico', 11),
('Fisio', 12),
('Famiglia', 13)
ON CONFLICT (name) DO NOTHING;

-- 3. Verifica i ruoli inseriti
SELECT 'Ruoli giocatori:' as tipo, name, position_order FROM public.roles ORDER BY position_order
UNION ALL
SELECT 'Ruoli staff:' as tipo, name, position_order FROM public.user_roles ORDER BY position_order;



