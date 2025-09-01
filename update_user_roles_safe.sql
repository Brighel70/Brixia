-- Aggiornamento sicuro ruoli utente per IL Brixia Rugby
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica ruoli esistenti e profili che li usano
SELECT 
  ur.id,
  ur.name,
  ur.position_order,
  COUNT(p.id) as profili_assegnati
FROM user_roles ur
LEFT JOIN profiles p ON ur.id = p.user_role_id
GROUP BY ur.id, ur.name, ur.position_order
ORDER BY ur.position_order;

-- 2. Trova tutti i profili che usano "Amministratore"
SELECT 
  p.id,
  p.full_name,
  p.email,
  ur.name as ruolo_attuale
FROM profiles p
JOIN user_roles ur ON p.user_role_id = ur.id
WHERE ur.name = 'Amministratore';

-- 3. Trova l'ID del ruolo "Admin"
SELECT id, name, position_order FROM user_roles WHERE name = 'Admin';

-- 4. Aggiorna tutti i profili da "Amministratore" a "Admin"
-- Sostituisci 'ADMIN_ROLE_ID' con l'ID effettivo del ruolo Admin
UPDATE profiles 
SET user_role_id = (
  SELECT id FROM user_roles WHERE name = 'Admin'
)
WHERE user_role_id IN (
  SELECT id FROM user_roles WHERE name = 'Amministratore'
);

-- 5. Verifica che l'aggiornamento sia andato a buon fine
SELECT 
  p.id,
  p.full_name,
  p.email,
  ur.name as nuovo_ruolo
FROM profiles p
JOIN user_roles ur ON p.user_role_id = ur.id
WHERE p.full_name IN (
  SELECT full_name FROM profiles 
  WHERE user_role_id IN (
    SELECT id FROM user_roles WHERE name = 'Amministratore'
  )
);

-- 6. Ora puoi rimuovere il ruolo "Amministratore" in sicurezza
DELETE FROM user_roles WHERE name = 'Amministratore';

-- 7. Verifica che "Admin" abbia posizione 1
UPDATE user_roles 
SET position_order = 1 
WHERE name = 'Admin';

-- 8. Verifica la struttura finale
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

-- 9. Verifica che tutti i profili abbiano ruoli validi
SELECT 
  ur.name as ruolo,
  COUNT(p.id) as profili_assegnati
FROM user_roles ur
LEFT JOIN profiles p ON ur.id = p.user_role_id
GROUP BY ur.id, ur.name
ORDER BY ur.position_order;

-- 10. Se necessario, assegna tutti i permessi ad Admin
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

-- 11. Verifica finale per Admin
SELECT 
  'Admin' as ruolo,
  COUNT(rp.permission_id) as permessi_totali,
  (SELECT COUNT(*) FROM permissions) as permessi_disponibili
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
WHERE ur.name = 'Admin';

-- IMPORTANTE: 
-- - Esegui questo script in ordine
-- - Verifica ogni passaggio prima di procedere
-- - Se hai molti profili, considera di fare backup prima
-- - Il ruolo "Admin" deve esistere prima di eseguire questo script


