-- Script per popolare la tabella user_roles con i ruoli staff
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Pulisci i ruoli esistenti (ATTENZIONE: questo rimuoverà tutti i ruoli esistenti)
DELETE FROM role_permissions;
DELETE FROM user_roles;

-- 2. Inserisci i ruoli staff con ordine di priorità
INSERT INTO user_roles (id, name, position_order) VALUES
  (gen_random_uuid(), 'Admin', 1),
  (gen_random_uuid(), 'Dirigente', 2),
  (gen_random_uuid(), 'Segreteria', 3),
  (gen_random_uuid(), 'Direttore Sportivo', 4),
  (gen_random_uuid(), 'Direttore Tecnico', 5),
  (gen_random_uuid(), 'Allenatore', 6),
  (gen_random_uuid(), 'Team Manager', 7),
  (gen_random_uuid(), 'Accompagnatore', 8),
  (gen_random_uuid(), 'Preparatore', 9),
  (gen_random_uuid(), 'Medico', 10),
  (gen_random_uuid(), 'Fisio', 11),
  (gen_random_uuid(), 'Player', 12),
  (gen_random_uuid(), 'Famiglia', 13)
ON CONFLICT (name) DO NOTHING;

-- 3. Verifica che i ruoli siano stati inseriti
SELECT 
  name, 
  position_order,
  created_at
FROM user_roles 
ORDER BY position_order;

-- 4. Conta i ruoli inseriti
SELECT COUNT(*) as total_roles FROM user_roles;

