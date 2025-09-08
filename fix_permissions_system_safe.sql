-- ========================================
-- FIX SISTEMA PERMESSI - VERSIONE SICURA
-- ========================================
-- Questo script riabilita il sistema di permessi in modo sicuro

-- 1. PRIMA VERIFICA LO STATO ATTUALE
SELECT '=== STATO ATTUALE ===' as info;

-- Mostra i profili esistenti con i loro ruoli
SELECT 
  'Profili esistenti:' as info,
  p.id,
  p.full_name,
  p.role,
  p.user_role_id,
  ur.name as ruolo_nome
FROM profiles p
LEFT JOIN user_roles ur ON p.user_role_id = ur.id
ORDER BY p.created_at;

-- Mostra i ruoli esistenti
SELECT 
  'Ruoli esistenti:' as info,
  id,
  name,
  position_order
FROM user_roles
ORDER BY position_order;

-- 2. AGGIORNA I RUOLI ESISTENTI INVECE DI ELIMINARLI
-- Prima aggiorna i ruoli esistenti con i nomi corretti
UPDATE user_roles 
SET name = CASE 
  WHEN name = 'Coach' THEN 'Allenatore'
  WHEN name = 'Medic' THEN 'Medico'
  WHEN name = 'Director' THEN 'Direttore Sportivo'
  WHEN name = 'Staff' THEN 'Segreteria'
  ELSE name
END
WHERE name IN ('Coach', 'Medic', 'Director', 'Staff');

-- 3. AGGIUNGI I RUOLI MANCANTI
INSERT INTO user_roles (id, name, position_order) VALUES
  (gen_random_uuid(), 'Dirigente', 2),
  (gen_random_uuid(), 'Segreteria', 3),
  (gen_random_uuid(), 'Direttore Sportivo', 4),
  (gen_random_uuid(), 'Direttore Tecnico', 5),
  (gen_random_uuid(), 'Team Manager', 7),
  (gen_random_uuid(), 'Accompagnatore', 8),
  (gen_random_uuid(), 'Player', 9),
  (gen_random_uuid(), 'Preparatore', 10),
  (gen_random_uuid(), 'Fisio', 12),
  (gen_random_uuid(), 'Famiglia', 13)
ON CONFLICT (name) DO NOTHING;

-- 4. AGGIORNA I PERMESSI ESISTENTI
-- Prima elimina solo i permessi (non i ruoli)
DELETE FROM role_permissions;

-- Inserisci i permessi aggiornati
INSERT INTO permissions (id, name, description, category, position_order) VALUES
  (gen_random_uuid(), 'players.view', 'Visualizza giocatori', 'players', 1),
  (gen_random_uuid(), 'players.create', 'Crea giocatori', 'players', 2),
  (gen_random_uuid(), 'players.edit', 'Modifica giocatori', 'players', 3),
  (gen_random_uuid(), 'players.delete', 'Elimina giocatori', 'players', 4),
  (gen_random_uuid(), 'players.export', 'Esporta giocatori', 'players', 5),
  
  (gen_random_uuid(), 'events.view', 'Visualizza eventi', 'events', 1),
  (gen_random_uuid(), 'events.create', 'Crea eventi', 'events', 2),
  (gen_random_uuid(), 'events.edit', 'Modifica eventi', 'events', 3),
  (gen_random_uuid(), 'events.delete', 'Elimina eventi', 'events', 4),
  
  (gen_random_uuid(), 'sessions.view', 'Visualizza sessioni', 'sessions', 1),
  (gen_random_uuid(), 'sessions.create', 'Crea sessioni', 'sessions', 2),
  (gen_random_uuid(), 'sessions.edit', 'Modifica sessioni', 'sessions', 3),
  (gen_random_uuid(), 'sessions.delete', 'Elimina sessioni', 'sessions', 4),
  (gen_random_uuid(), 'sessions.start', 'Avvia sessioni', 'sessions', 5),
  (gen_random_uuid(), 'sessions.stop', 'Ferma sessioni', 'sessions', 6),
  
  (gen_random_uuid(), 'attendance.view', 'Visualizza presenze', 'attendance', 1),
  (gen_random_uuid(), 'attendance.mark', 'Segna presenze', 'attendance', 2),
  (gen_random_uuid(), 'attendance.edit', 'Modifica presenze', 'attendance', 3),
  (gen_random_uuid(), 'attendance.export', 'Esporta presenze', 'attendance', 4),
  
  (gen_random_uuid(), 'staff.view', 'Visualizza staff', 'staff', 1),
  (gen_random_uuid(), 'staff.create', 'Crea staff', 'staff', 2),
  (gen_random_uuid(), 'staff.edit', 'Modifica staff', 'staff', 3),
  (gen_random_uuid(), 'staff.delete', 'Elimina staff', 'staff', 4),
  
  (gen_random_uuid(), 'categories.view', 'Visualizza categorie', 'categories', 1),
  (gen_random_uuid(), 'categories.create', 'Crea categorie', 'categories', 2),
  (gen_random_uuid(), 'categories.edit', 'Modifica categorie', 'categories', 3),
  (gen_random_uuid(), 'categories.delete', 'Elimina categorie', 'categories', 4),
  
  (gen_random_uuid(), 'settings.view', 'Visualizza impostazioni', 'settings', 1),
  (gen_random_uuid(), 'settings.edit', 'Modifica impostazioni', 'settings', 2),
  (gen_random_uuid(), 'settings.brand', 'Gestisce brand', 'settings', 3),
  
  (gen_random_uuid(), 'users.view', 'Visualizza utenti', 'users', 1),
  (gen_random_uuid(), 'users.create', 'Crea utenti', 'users', 2),
  (gen_random_uuid(), 'users.edit', 'Modifica utenti', 'users', 3),
  (gen_random_uuid(), 'users.delete', 'Elimina utenti', 'users', 4),
  (gen_random_uuid(), 'users.roles', 'Gestisce ruoli', 'users', 5)
ON CONFLICT (name) DO NOTHING;

-- 5. AGGIORNA I PROFILI ESISTENTI CON I RUOLI CORRETTI
-- Prima aggiorna i profili che hanno ruoli vecchi
UPDATE profiles 
SET user_role_id = (
  SELECT ur.id 
  FROM user_roles ur 
  WHERE ur.name = CASE 
    WHEN profiles.role = 'admin' THEN 'Admin'
    WHEN profiles.role = 'coach' THEN 'Allenatore'
    WHEN profiles.role = 'medic' THEN 'Medico'
    WHEN profiles.role = 'director' THEN 'Direttore Sportivo'
    ELSE 'Allenatore' -- Default fallback
  END
)
WHERE user_role_id IS NULL;

-- 6. ASSEGNA PERMESSI AI RUOLI
-- Admin: tutti i permessi
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Dirigente: quasi tutti i permessi, tranne gestione utenti completa
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Dirigente' 
  AND p.name NOT IN ('users.create', 'users.edit', 'users.delete', 'users.roles')
ON CONFLICT DO NOTHING;

-- Segreteria: gestione amministrativa
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Segreteria' 
  AND p.name IN (
    'players.view', 'players.create', 'players.edit',
    'events.view', 'sessions.view', 'attendance.view',
    'staff.view', 'categories.view', 'users.view',
    'settings.view'
  )
ON CONFLICT DO NOTHING;

-- Direttore Sportivo: gestione sportiva
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Direttore Sportivo' 
  AND p.name IN (
    'players.view', 'players.create', 'players.edit', 'players.delete', 'players.export',
    'events.view', 'events.create', 'events.edit', 'events.delete',
    'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete',
    'attendance.view', 'attendance.mark', 'attendance.edit', 'attendance.export',
    'categories.view', 'categories.create', 'categories.edit',
    'settings.view', 'settings.edit'
  )
ON CONFLICT DO NOTHING;

-- Direttore Tecnico: gestione tecnica
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Direttore Tecnico' 
  AND p.name IN (
    'players.view', 'players.create', 'players.edit',
    'events.view', 'events.create', 'events.edit',
    'sessions.view', 'sessions.create', 'sessions.edit',
    'attendance.view', 'attendance.mark', 'attendance.edit',
    'categories.view'
  )
ON CONFLICT DO NOTHING;

-- Allenatore: gestione allenamenti
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Allenatore' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'events.create', 'events.edit',
    'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.start', 'sessions.stop',
    'attendance.view', 'attendance.mark', 'attendance.edit',
    'categories.view'
  )
ON CONFLICT DO NOTHING;

-- Team Manager: gestione squadra
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Team Manager' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark',
    'categories.view'
  )
ON CONFLICT DO NOTHING;

-- Accompagnatore: supporto
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Accompagnatore' 
  AND p.name IN (
    'players.view', 'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark'
  )
ON CONFLICT DO NOTHING;

-- Player: accesso limitato
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Player' 
  AND p.name IN (
    'players.view', 'events.view', 'sessions.view',
    'attendance.view', 'categories.view'
  )
ON CONFLICT DO NOTHING;

-- Preparatore: preparazione fisica
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Preparatore' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'events.create', 'events.edit',
    'sessions.view', 'sessions.create', 'sessions.edit',
    'attendance.view', 'attendance.mark', 'attendance.edit'
  )
ON CONFLICT DO NOTHING;

-- Medico: informazioni sanitarie
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Medico' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark'
  )
ON CONFLICT DO NOTHING;

-- Fisio: fisioterapia
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Fisio' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark'
  )
ON CONFLICT DO NOTHING;

-- Famiglia: accesso limitato
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Famiglia' 
  AND p.name IN (
    'players.view', 'events.view', 'sessions.view'
  )
ON CONFLICT DO NOTHING;

-- 7. VERIFICA IL RISULTATO
SELECT '=== RISULTATO FINALE ===' as info;

-- Mostra i profili aggiornati
SELECT 
  'Profili aggiornati:' as info,
  p.id,
  p.full_name,
  p.role,
  ur.name as ruolo_corretto,
  p.email
FROM profiles p
LEFT JOIN user_roles ur ON p.user_role_id = ur.id
ORDER BY p.created_at;

-- Conta i profili per ruolo
SELECT 
  'Distribuzione ruoli:' as info,
  ur.name as ruolo,
  COUNT(p.id) as numero_utenti
FROM user_roles ur
LEFT JOIN profiles p ON ur.id = p.user_role_id
GROUP BY ur.name, ur.position_order
ORDER BY ur.position_order;

-- Mostra i permessi per ruolo
SELECT 
  'Permessi per ruolo:' as info,
  ur.name as ruolo,
  p.category as categoria,
  COUNT(rp.permission_id) as permessi
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY ur.name, p.category, ur.position_order
ORDER BY ur.position_order, p.category;

SELECT '=== SISTEMA PERMESSI RIABILITATO ===' as info;

