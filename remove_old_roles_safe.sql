-- ========================================
-- RIMUOVI RUOLI VECCHI - VERSIONE SICURA
-- ========================================
-- Questo script rimuove i ruoli vecchi dopo aver aggiornato i profili

-- 1. VERIFICA QUALI RUOLI VECCHI ESISTONO
SELECT '=== RUOLI VECCHI DA RIMUOVERE ===' as info;

SELECT 
  'Ruoli vecchi:' as info,
  id,
  name,
  position_order
FROM user_roles
WHERE name IN ('Coach', 'Medic', 'Director', 'Staff')
ORDER BY position_order;

-- 2. VERIFICA SE CI SONO PROFILI CHE USANO QUESTI RUOLI
SELECT 
  'Profili che usano ruoli vecchi:' as info,
  p.id,
  p.full_name,
  p.role,
  ur.name as ruolo_attuale
FROM profiles p
JOIN user_roles ur ON p.user_role_id = ur.id
WHERE ur.name IN ('Coach', 'Medic', 'Director', 'Staff');

-- 3. AGGIORNA I PROFILI CHE USANO RUOLI VECCHI
-- Prima aggiorna i profili per usare i ruoli nuovi
UPDATE profiles 
SET user_role_id = (
  SELECT ur_new.id 
  FROM user_roles ur_new 
  WHERE ur_new.name = CASE 
    WHEN ur_old.name = 'Coach' THEN 'Allenatore'
    WHEN ur_old.name = 'Medic' THEN 'Medico'
    WHEN ur_old.name = 'Director' THEN 'Direttore Sportivo'
    WHEN ur_old.name = 'Staff' THEN 'Segreteria'
    ELSE ur_old.name
  END
)
FROM user_roles ur_old
WHERE profiles.user_role_id = ur_old.id
  AND ur_old.name IN ('Coach', 'Medic', 'Director', 'Staff');

-- 4. RIMUOVI I RUOLI VECCHI
-- Prima rimuovi le associazioni permessi-ruoli
DELETE FROM role_permissions 
WHERE role_id IN (
  SELECT id FROM user_roles 
  WHERE name IN ('Coach', 'Medic', 'Director', 'Staff')
);

-- Poi rimuovi i ruoli stessi
DELETE FROM user_roles 
WHERE name IN ('Coach', 'Medic', 'Director', 'Staff');

-- 5. VERIFICA IL RISULTATO
SELECT '=== RISULTATO FINALE ===' as info;

-- Mostra i ruoli rimanenti
SELECT 
  'Ruoli finali:' as info,
  id,
  name,
  position_order
FROM user_roles
ORDER BY position_order;

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
  'Distribuzione ruoli finali:' as info,
  ur.name as ruolo,
  COUNT(p.id) as numero_utenti
FROM user_roles ur
LEFT JOIN profiles p ON ur.id = p.user_role_id
GROUP BY ur.name, ur.position_order
ORDER BY ur.position_order;

SELECT '=== RUOLI VECCHI RIMOSSI ===' as info;

