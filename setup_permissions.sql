-- Script per configurare il sistema di permessi
-- Esegui questo script nel tuo database Supabase

-- 1. Inserisci i ruoli utente base
INSERT INTO user_roles (id, name, position_order) VALUES
  (gen_random_uuid(), 'Amministratore', 1),
  (gen_random_uuid(), 'Allenatore', 2),
  (gen_random_uuid(), 'Medico', 3),
  (gen_random_uuid(), 'Direttore', 4)
ON CONFLICT (name) DO NOTHING;

-- 2. Inserisci i permessi base
INSERT INTO permissions (id, name, description, category, position_order) VALUES
  -- Permessi per le attività
  (gen_random_uuid(), 'view_activities', 'Visualizza attività e sessioni', 'activities', 1),
  (gen_random_uuid(), 'create_activities', 'Crea nuove attività', 'activities', 2),
  (gen_random_uuid(), 'edit_activities', 'Modifica attività esistenti', 'activities', 3),
  (gen_random_uuid(), 'delete_activities', 'Elimina attività', 'activities', 4),
  (gen_random_uuid(), 'manage_attendance', 'Gestisce presenze e assenze', 'activities', 5),
  
  -- Permessi per gli utenti
  (gen_random_uuid(), 'view_users', 'Visualizza lista utenti', 'users', 1),
  (gen_random_uuid(), 'create_users', 'Crea nuovi utenti', 'users', 2),
  (gen_random_uuid(), 'edit_users', 'Modifica utenti esistenti', 'users', 3),
  (gen_random_uuid(), 'delete_users', 'Elimina utenti', 'users', 4),
  (gen_random_uuid(), 'manage_roles', 'Gestisce ruoli e permessi', 'users', 5),
  
  -- Permessi per i giocatori
  (gen_random_uuid(), 'view_players', 'Visualizza lista giocatori', 'players', 1),
  (gen_random_uuid(), 'create_players', 'Crea nuovi giocatori', 'players', 2),
  (gen_random_uuid(), 'edit_players', 'Modifica giocatori esistenti', 'players', 3),
  (gen_random_uuid(), 'delete_players', 'Elimina giocatori', 'players', 4),
  (gen_random_uuid(), 'manage_player_categories', 'Gestisce categorie giocatori', 'players', 5),
  
  -- Permessi per le categorie
  (gen_random_uuid(), 'view_categories', 'Visualizza categorie', 'categories', 1),
  (gen_random_uuid(), 'create_categories', 'Crea nuove categorie', 'categories', 2),
  (gen_random_uuid(), 'edit_categories', 'Modifica categorie esistenti', 'categories', 3),
  (gen_random_uuid(), 'delete_categories', 'Elimina categorie', 'categories', 4),
  
  -- Permessi per le sessioni
  (gen_random_uuid(), 'view_sessions', 'Visualizza sessioni', 'sessions', 1),
  (gen_random_uuid(), 'create_sessions', 'Crea nuove sessioni', 'sessions', 2),
  (gen_random_uuid(), 'edit_sessions', 'Modifica sessioni esistenti', 'sessions', 3),
  (gen_random_uuid(), 'delete_sessions', 'Elimina sessioni', 'sessions', 4),
  (gen_random_uuid(), 'manage_presence', 'Gestisce presenze sessioni', 'sessions', 5),
  
  -- Permessi di sistema
  (gen_random_uuid(), 'manage_settings', 'Gestisce impostazioni sistema', 'system', 1),
  (gen_random_uuid(), 'view_logs', 'Visualizza log sistema', 'system', 2),
  (gen_random_uuid(), 'manage_backup', 'Gestisce backup', 'system', 3),
  (gen_random_uuid(), 'system_admin', 'Accesso amministrativo completo', 'system', 4),
  
  -- Permessi per i report
  (gen_random_uuid(), 'view_reports', 'Visualizza report', 'reports', 1),
  (gen_random_uuid(), 'create_reports', 'Crea nuovi report', 'reports', 2),
  (gen_random_uuid(), 'export_reports', 'Esporta report', 'reports', 3),
  (gen_random_uuid(), 'view_analytics', 'Visualizza analytics', 'reports', 4)
ON CONFLICT (name) DO NOTHING;

-- 3. Assegna tutti i permessi al ruolo Amministratore
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Amministratore'
ON CONFLICT DO NOTHING;

-- 4. Assegna permessi al ruolo Allenatore
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

-- 5. Assegna permessi al ruolo Medico
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

-- 6. Assegna permessi al ruolo Direttore
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Direttore' 
  AND p.name IN (
    'view_activities', 'view_players', 'view_categories', 'view_sessions', 
    'view_users', 'view_reports', 'create_reports', 'export_reports', 'view_analytics'
  )
ON CONFLICT DO NOTHING;

-- 7. Assegna il ruolo Amministratore all'utente esistente (Andrea Bulgari)
UPDATE profiles 
SET user_role_id = (SELECT id FROM user_roles WHERE name = 'Amministratore')
WHERE user_role_id IS NULL;

-- 8. Verifica finale
SELECT 
  'Utenti totali' as info,
  COUNT(*) as count
FROM profiles
UNION ALL
SELECT 
  'Utenti con ruolo' as info,
  COUNT(*) as count
FROM profiles 
WHERE user_role_id IS NOT NULL
UNION ALL
SELECT 
  'Ruoli creati' as info,
  COUNT(*) as count
FROM user_roles
UNION ALL
SELECT 
  'Permessi creati' as info,
  COUNT(*) as count
FROM permissions
UNION ALL
SELECT 
  'Collegamenti ruolo-permessi' as info,
  COUNT(*) as count
FROM role_permissions;




