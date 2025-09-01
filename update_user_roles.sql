-- Aggiornamento ruoli utente per IL Brixia Rugby
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica ruoli esistenti
SELECT id, name, position_order FROM user_roles ORDER BY position_order;

-- 2. Rimuovi "Amministratore" se esiste (sostituito da "Admin")
DELETE FROM user_roles WHERE name = 'Amministratore';

-- 3. Aggiorna "Admin" se necessario per assicurarti che abbia posizione 1
UPDATE user_roles 
SET position_order = 1 
WHERE name = 'Admin';

-- 4. Verifica che "Admin" abbia tutti i permessi necessari
-- (Questo dovrebbe essere già configurato nel sistema)

-- 5. Verifica la struttura finale
SELECT 
  id, 
  name, 
  position_order,
  CASE 
    WHEN name = 'Admin' THEN 'Ruolo principale con tutti i permessi'
    WHEN name = 'Dirigente' THEN 'Gestione organizzativa'
    WHEN name = 'Medico' THEN 'Gestione salute giocatori'
    WHEN name = 'Coach' THEN 'Gestione allenamenti e presenze'
    WHEN name = 'Direttore Tecnico' THEN 'Gestione tecnica'
    WHEN name = 'Direttore Sportivo' THEN 'Gestione sportiva'
    ELSE 'Ruolo personalizzato'
  END as descrizione
FROM user_roles 
ORDER BY position_order;

-- 6. Verifica che tutti i ruoli abbiano i permessi appropriati
SELECT 
  ur.name as ruolo,
  COUNT(rp.permission_id) as permessi_assegnati
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
GROUP BY ur.id, ur.name
ORDER BY ur.position_order;

-- 7. Se necessario, assegna tutti i permessi ad Admin
-- (Solo se Admin non ha già tutti i permessi)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  ur.id as role_id,
  p.id as permission_id
FROM user_roles ur
CROSS JOIN permissions p
WHERE ur.name = 'Admin'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role_id = ur.id AND rp.permission_id = p.id
  );

-- 8. Verifica finale
SELECT 
  'Admin' as ruolo,
  COUNT(rp.permission_id) as permessi_totali,
  (SELECT COUNT(*) FROM permissions) as permessi_disponibili
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
WHERE ur.name = 'Admin';

-- Note:
-- - "Admin" è il ruolo principale con accesso completo
-- - "Dirigente" per gestione organizzativa
-- - "Medico" per gestione salute giocatori
-- - "Coach" per gestione allenamenti e presenze
-- - Altri ruoli per funzioni specifiche


