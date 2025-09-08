-- ========================================
-- SCRIPT MINIMALE PER RIABILITARE IL SISTEMA DI PERMESSI
-- ========================================

-- 1. Prima verifichiamo la struttura della tabella user_roles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
ORDER BY ordinal_position;

-- 2. Aggiorna i ruoli esistenti (solo i campi che esistono)
UPDATE user_roles SET 
  name = 'Admin'
WHERE name = 'admin' OR name = 'ADMIN';

UPDATE user_roles SET 
  name = 'Dirigente'
WHERE name = 'dirigente' OR name = 'DIRIGENTE';

UPDATE user_roles SET 
  name = 'Segreteria'
WHERE name = 'segreteria' OR name = 'SEGRETERIA';

UPDATE user_roles SET 
  name = 'Direttore Sportivo'
WHERE name = 'direttore_sportivo' OR name = 'DIRETTORE_SPORTIVO';

UPDATE user_roles SET 
  name = 'Direttore Tecnico'
WHERE name = 'direttore_tecnico' OR name = 'DIRETTORE_TECNICO';

UPDATE user_roles SET 
  name = 'Allenatore'
WHERE name = 'allenatore' OR name = 'ALLENATORE';

UPDATE user_roles SET 
  name = 'Team Manager'
WHERE name = 'team_manager' OR name = 'TEAM_MANAGER';

UPDATE user_roles SET 
  name = 'Accompagnatore'
WHERE name = 'accompagnatore' OR name = 'ACCOMPAGNATORE';

UPDATE user_roles SET 
  name = 'Player'
WHERE name = 'player' OR name = 'PLAYER';

UPDATE user_roles SET 
  name = 'Preparatore'
WHERE name = 'preparatore' OR name = 'PREPARATORE';

UPDATE user_roles SET 
  name = 'Medico'
WHERE name = 'medico' OR name = 'MEDICO';

UPDATE user_roles SET 
  name = 'Fisio'
WHERE name = 'fisio' OR name = 'FISIO';

UPDATE user_roles SET 
  name = 'Famiglia'
WHERE name = 'famiglia' OR name = 'FAMIGLIA';

-- 3. Aggiungi ruoli mancanti (solo con i campi che esistono)
INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Admin',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Admin');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Dirigente',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Dirigente');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Segreteria',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Segreteria');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Direttore Sportivo',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Direttore Sportivo');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Direttore Tecnico',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Direttore Tecnico');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Allenatore',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Allenatore');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Team Manager',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Team Manager');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Accompagnatore',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Accompagnatore');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Player',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Player');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Preparatore',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Preparatore');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Medico',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Medico');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Fisio',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Fisio');

INSERT INTO user_roles (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'Famiglia',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Famiglia');

-- 4. Aggiungi permessi (solo con i campi che esistono)
INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'manage_users',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_users');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'manage_players',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_players');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'manage_sessions',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_sessions');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'manage_events',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_events');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'manage_categories',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_categories');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'view_reports',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_reports');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'manage_settings',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'manage_settings');

INSERT INTO permissions (id, name, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'view_attendance',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'view_attendance');

-- 5. Assegna permessi ai ruoli
-- Admin: tutti i permessi
INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT 
  ur.id,
  p.id,
  now(),
  now()
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Admin'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role_id = ur.id AND rp.permission_id = p.id
);

-- Dirigente: tutti i permessi tranne gestione utenti
INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT 
  ur.id,
  p.id,
  now(),
  now()
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Dirigente'
AND p.name != 'manage_users'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role_id = ur.id AND rp.permission_id = p.id
);

-- Allenatore: gestione giocatori, sessioni, presenze
INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT 
  ur.id,
  p.id,
  now(),
  now()
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Allenatore'
AND p.name IN ('manage_players', 'manage_sessions', 'view_attendance')
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role_id = ur.id AND rp.permission_id = p.id
);

-- Player: solo visualizzazione presenze
INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at)
SELECT 
  ur.id,
  p.id,
  now(),
  now()
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Player'
AND p.name = 'view_attendance'
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp 
  WHERE rp.role_id = ur.id AND rp.permission_id = p.id
);

-- 6. Aggiorna i profili esistenti per collegarli ai ruoli
UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Admin' LIMIT 1)
WHERE role = 'Admin' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Dirigente' LIMIT 1)
WHERE role = 'Dirigente' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Segreteria' LIMIT 1)
WHERE role = 'Segreteria' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Direttore Sportivo' LIMIT 1)
WHERE role = 'Direttore Sportivo' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Direttore Tecnico' LIMIT 1)
WHERE role = 'Direttore Tecnico' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Allenatore' LIMIT 1)
WHERE role = 'Allenatore' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Team Manager' LIMIT 1)
WHERE role = 'Team Manager' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Accompagnatore' LIMIT 1)
WHERE role = 'Accompagnatore' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Player' LIMIT 1)
WHERE role = 'Player' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Preparatore' LIMIT 1)
WHERE role = 'Preparatore' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Medico' LIMIT 1)
WHERE role = 'Medico' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Fisio' LIMIT 1)
WHERE role = 'Fisio' AND user_role_id IS NULL;

UPDATE profiles SET 
  user_role_id = (SELECT id FROM user_roles WHERE name = 'Famiglia' LIMIT 1)
WHERE role = 'Famiglia' AND user_role_id IS NULL;

-- 7. Verifica finale
SELECT 
  'Ruoli creati' as info,
  COUNT(*) as count
FROM user_roles;

SELECT 
  'Permessi creati' as info,
  COUNT(*) as count
FROM permissions;

SELECT 
  'Associazioni ruolo-permesso' as info,
  COUNT(*) as count
FROM role_permissions;

SELECT 
  'Profili aggiornati' as info,
  COUNT(*) as count
FROM profiles 
WHERE user_role_id IS NOT NULL;

