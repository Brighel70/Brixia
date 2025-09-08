-- Script per popolare SOLO i ruoli delle persone (tabella user_roles)
-- Esegui questo script nel SQL Editor di Supabase

-- Inserisci ruoli delle persone (tabella user_roles)
INSERT INTO public.user_roles (name, position_order) VALUES 
('Admin', 1),
('Dirigente', 2),
('Segreteria', 3),
('Direttore Sportivo', 4),
('Direttore Tecnico', 5),
('Allenatore', 6),
('Team Manager', 7),
('Accompagnatore', 8),
('Preparatore', 9),
('Medico', 10),
('Fisio', 11),
('Famiglia', 12)
ON CONFLICT (name) DO NOTHING;

-- Verifica i ruoli inseriti
SELECT 'Ruoli persone inseriti:' as info, name, position_order 
FROM public.user_roles 
ORDER BY position_order;



