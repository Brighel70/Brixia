-- Fix rapido per aggiornare profili da "Amministratore" ad "Admin"
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Aggiorna tutti i profili da "Amministratore" a "Admin"
UPDATE profiles 
SET user_role_id = (
  SELECT id FROM user_roles WHERE name = 'Admin'
)
WHERE user_role_id IN (
  SELECT id FROM user_roles WHERE name = 'Amministratore'
);

-- 2. Ora puoi rimuovere il ruolo "Amministratore" in sicurezza
DELETE FROM user_roles WHERE name = 'Amministratore';

-- 3. Verifica che tutto sia andato a buon fine
SELECT 
  ur.name as ruolo,
  COUNT(p.id) as profili_assegnati
FROM user_roles ur
LEFT JOIN profiles p ON ur.id = p.user_role_id
GROUP BY ur.id, ur.name
ORDER BY ur.position_order;

-- 4. Verifica che "Admin" abbia posizione 1
UPDATE user_roles 
SET position_order = 1 
WHERE name = 'Admin';

-- 5. Risultato finale
SELECT '✅ Aggiornamento completato!' as status;


