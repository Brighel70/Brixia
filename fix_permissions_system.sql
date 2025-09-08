-- ========================================
-- FIX SISTEMA PERMESSI - BRIXIA RUGBY
-- ========================================
-- Questo script riabilita completamente il sistema di permessi

-- 1. Pulisci i dati esistenti
DELETE FROM role_permissions;
DELETE FROM permissions;
DELETE FROM user_roles;

-- 2. Inserisci i ruoli utente
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
  (gen_random_uuid(), 'Famiglia', 13);

-- 3. Inserisci i permessi
INSERT INTO permissions (id, name, description, category, position_order) VALUES
  -- Permessi Giocatori
  (gen_random_uuid(), 'players.view', 'Visualizza giocatori', 'players', 1),
  (gen_random_uuid(), 'players.create', 'Crea giocatori', 'players', 2),
  (gen_random_uuid(), 'players.edit', 'Modifica giocatori', 'players', 3),
  (gen_random_uuid(), 'players.delete', 'Elimina giocatori', 'players', 4),
  (gen_random_uuid(), 'players.export', 'Esporta giocatori', 'players', 5),
  
  -- Permessi Eventi
  (gen_random_uuid(), 'events.view', 'Visualizza eventi', 'events', 1),
  (gen_random_uuid(), 'events.create', 'Crea eventi', 'events', 2),
  (gen_random_uuid(), 'events.edit', 'Modifica eventi', 'events', 3),
  (gen_random_uuid(), 'events.delete', 'Elimina eventi', 'events', 4),
  
  -- Permessi Sessioni
  (gen_random_uuid(), 'sessions.view', 'Visualizza sessioni', 'sessions', 1),
  (gen_random_uuid(), 'sessions.create', 'Crea sessioni', 'sessions', 2),
  (gen_random_uuid(), 'sessions.edit', 'Modifica sessioni', 'sessions', 3),
  (gen_random_uuid(), 'sessions.delete', 'Elimina sessioni', 'sessions', 4),
  (gen_random_uuid(), 'sessions.start', 'Avvia sessioni', 'sessions', 5),
  (gen_random_uuid(), 'sessions.stop', 'Ferma sessioni', 'sessions', 6),
  
  -- Permessi Presenze
  (gen_random_uuid(), 'attendance.view', 'Visualizza presenze', 'attendance', 1),
  (gen_random_uuid(), 'attendance.mark', 'Segna presenze', 'attendance', 2),
  (gen_random_uuid(), 'attendance.edit', 'Modifica presenze', 'attendance', 3),
  (gen_random_uuid(), 'attendance.export', 'Esporta presenze', 'attendance', 4),
  
  -- Permessi Staff
  (gen_random_uuid(), 'staff.view', 'Visualizza staff', 'staff', 1),
  (gen_random_uuid(), 'staff.create', 'Crea staff', 'staff', 2),
  (gen_random_uuid(), 'staff.edit', 'Modifica staff', 'staff', 3),
  (gen_random_uuid(), 'staff.delete', 'Elimina staff', 'staff', 4),
  
  -- Permessi Categorie
  (gen_random_uuid(), 'categories.view', 'Visualizza categorie', 'categories', 1),
  (gen_random_uuid(), 'categories.create', 'Crea categorie', 'categories', 2),
  (gen_random_uuid(), 'categories.edit', 'Modifica categorie', 'categories', 3),
  (gen_random_uuid(), 'categories.delete', 'Elimina categorie', 'categories', 4),
  
  -- Permessi Impostazioni
  (gen_random_uuid(), 'settings.view', 'Visualizza impostazioni', 'settings', 1),
  (gen_random_uuid(), 'settings.edit', 'Modifica impostazioni', 'settings', 2),
  (gen_random_uuid(), 'settings.brand', 'Gestisce brand', 'settings', 3),
  
  -- Permessi Utenti
  (gen_random_uuid(), 'users.view', 'Visualizza utenti', 'users', 1),
  (gen_random_uuid(), 'users.create', 'Crea utenti', 'users', 2),
  (gen_random_uuid(), 'users.edit', 'Modifica utenti', 'users', 3),
  (gen_random_uuid(), 'users.delete', 'Elimina utenti', 'users', 4),
  (gen_random_uuid(), 'users.roles', 'Gestisce ruoli', 'users', 5);

-- 4. Assegna permessi ai ruoli
-- Admin: tutti i permessi
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Admin';

-- Dirigente: quasi tutti i permessi, tranne gestione utenti completa
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Dirigente' 
  AND p.name NOT IN ('users.create', 'users.edit', 'users.delete', 'users.roles');

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
  );

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
  );

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
  );

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
  );

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
  );

-- Accompagnatore: supporto
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Accompagnatore' 
  AND p.name IN (
    'players.view', 'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark'
  );

-- Player: accesso limitato
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Player' 
  AND p.name IN (
    'players.view', 'events.view', 'sessions.view',
    'attendance.view', 'categories.view'
  );

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
  );

-- Medico: informazioni sanitarie
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Medico' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark'
  );

-- Fisio: fisioterapia
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Fisio' 
  AND p.name IN (
    'players.view', 'players.edit',
    'events.view', 'sessions.view',
    'attendance.view', 'attendance.mark'
  );

-- Famiglia: accesso limitato
INSERT INTO role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM user_roles ur, permissions p
WHERE ur.name = 'Famiglia' 
  AND p.name IN (
    'players.view', 'events.view', 'sessions.view'
  );

-- 5. Verifica il risultato
SELECT 
  'Ruoli creati:' as info,
  COUNT(*) as count
FROM user_roles;

SELECT 
  'Permessi creati:' as info,
  COUNT(*) as count
FROM permissions;

SELECT 
  'Associazioni ruoli-permessi:' as info,
  COUNT(*) as count
FROM role_permissions;

-- 6. Mostra i permessi per ruolo
SELECT 
  ur.name as ruolo,
  p.category as categoria,
  COUNT(p.id) as permessi
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
GROUP BY ur.name, p.category, ur.position_order
ORDER BY ur.position_order, p.category;

