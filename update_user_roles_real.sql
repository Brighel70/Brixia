-- Script per aggiornare i ruoli utente con quelli reali
-- Esegui questo script nel tuo database Supabase

-- 1. Pulisci i ruoli esistenti (ATTENZIONE: questo rimuoverà tutti i ruoli esistenti)
DELETE FROM role_permissions;
DELETE FROM user_roles;

-- 2. Inserisci i ruoli reali con ordine di priorità
INSERT INTO user_roles (id, name, position_order) VALUES
  (gen_random_uuid(), 'Admin', 1),
  (gen_random_uuid(), 'Dirigente', 2),
  (gen_random_uuid(), 'Segreteria', 3),
  (gen_random_uuid(), 'Direttore Sportivo', 4),
  (gen_random_uuid(), 'Direttore Tecnico', 5),
  (gen_random_uuid(), 'Allenatore', 6),
  (gen_random_uuid(), 'Team Manager', 7),
  (gen_random_uuid(), 'Accompagnatore', 8),
  (gen_random_uuid(), 'Player', 9),
  (gen_random_uuid(), 'Preparatore', 10),
  (gen_random_uuid(), 'Medico', 11),
  (gen_random_uuid(), 'Fisio', 12),
  (gen_random_uuid(), 'Famiglia', 13)
ON CONFLICT (name) DO NOTHING;

-- 3. Assegna TUTTI i permessi al ruolo Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Admin'
ON CONFLICT DO NOTHING;

-- 4. Assegna permessi al ruolo Dirigente (accesso quasi completo, tranne gestione utenti)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Dirigente' 
  AND p.name NOT IN (
    'create_users', 'edit_users', 'delete_users', 'manage_roles',
    'system_admin', 'manage_backup'
  )
ON CONFLICT DO NOTHING;

-- 5. Assegna permessi al ruolo Segreteria (gestione amministrativa)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Segreteria' 
  AND p.name IN (
    'view_activities', 'view_players', 'create_players', 'edit_players',
    'view_categories', 'view_sessions', 'view_users', 'view_reports', 
    'create_reports', 'export_reports', 'view_analytics'
  )
ON CONFLICT DO NOTHING;

-- 6. Assegna permessi al ruolo Direttore Sportivo (gestione sportiva)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Direttore Sportivo' 
  AND p.name IN (
    'view_activities', 'create_activities', 'edit_activities',
    'view_players', 'create_players', 'edit_players', 'delete_players',
    'view_categories', 'create_categories', 'edit_categories',
    'view_sessions', 'create_sessions', 'edit_sessions', 'delete_sessions',
    'manage_presence', 'view_reports', 'create_reports', 'export_reports'
  )
ON CONFLICT DO NOTHING;

-- 7. Assegna permessi al ruolo Direttore Tecnico (gestione tecnica)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Direttore Tecnico' 
  AND p.name IN (
    'view_activities', 'create_activities', 'edit_activities',
    'view_players', 'create_players', 'edit_players',
    'view_categories', 'view_sessions', 'create_sessions', 'edit_sessions',
    'manage_presence', 'view_reports', 'create_reports'
  )
ON CONFLICT DO NOTHING;

-- 8. Assegna permessi al ruolo Allenatore (gestione allenamenti)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Allenatore' 
  AND p.name IN (
    'view_activities', 'create_activities', 'edit_activities', 'manage_attendance',
    'view_players', 'edit_players', 'view_categories', 'view_sessions', 
    'create_sessions', 'edit_sessions', 'manage_presence', 'view_reports', 'create_reports'
  )
ON CONFLICT DO NOTHING;

-- 9. Assegna permessi al ruolo Team Manager (gestione squadra)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Team Manager' 
  AND p.name IN (
    'view_activities', 'view_players', 'edit_players', 'view_categories', 
    'view_sessions', 'manage_presence', 'view_reports', 'create_reports'
  )
ON CONFLICT DO NOTHING;

-- 10. Assegna permessi al ruolo Accompagnatore (supporto)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Accompagnatore' 
  AND p.name IN (
    'view_activities', 'view_players', 'view_sessions', 'manage_presence', 'view_reports'
  )
ON CONFLICT DO NOTHING;

-- 11. Assegna permessi al ruolo Player (accesso limitato ai propri dati e categoria)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Player' 
  AND p.name IN (
    'view_players', 'view_activities', 'view_sessions', 'view_categories'
  )
ON CONFLICT DO NOTHING;

-- 12. Assegna permessi al ruolo Preparatore (preparazione fisica)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Preparatore' 
  AND p.name IN (
    'view_activities', 'create_activities', 'edit_activities',
    'view_players', 'edit_players', 'view_sessions', 'create_sessions', 
    'edit_sessions', 'manage_presence', 'view_reports', 'create_reports'
  )
ON CONFLICT DO NOTHING;

-- 13. Assegna permessi al ruolo Medico (informazioni sanitarie)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Medico' 
  AND p.name IN (
    'view_players', 'edit_players', 'view_activities', 'view_sessions', 
    'view_reports', 'create_reports'
  )
ON CONFLICT DO NOTHING;

-- 14. Assegna permessi al ruolo Fisio (fisioterapia)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Fisio' 
  AND p.name IN (
    'view_players', 'edit_players', 'view_activities', 'view_sessions', 
    'view_reports', 'create_reports'
  )
ON CONFLICT DO NOTHING;

-- 15. Assegna permessi al ruolo Famiglia (accesso limitato)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Famiglia' 
  AND p.name IN (
    'view_players', 'view_activities', 'view_sessions', 'view_reports'
  )
ON CONFLICT DO NOTHING;

-- 16. Verifica finale
SELECT 
  'Ruoli creati' as info,
  COUNT(*) as count
FROM user_roles
UNION ALL
SELECT 
  'Collegamenti ruolo-permessi' as info,
  COUNT(*) as count
FROM role_permissions
UNION ALL
SELECT 
  'Permessi totali' as info,
  COUNT(*) as count
FROM permissions;

-- 17. Mostra i ruoli creati
SELECT 
  name as ruolo,
  position_order as priorita,
  (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = ur.id) as permessi_assegnati
FROM user_roles ur
ORDER BY position_order;
