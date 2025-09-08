-- Script per aggiornare il nome del ruolo da "Medicina" a "Medico"
-- Esegui questo script nel tuo database Supabase

-- 1. Aggiorna il nome del ruolo nella tabella user_roles
UPDATE user_roles 
SET name = 'Medico' 
WHERE name = 'Medicina';

-- 2. Verifica che l'aggiornamento sia stato applicato
SELECT id, name, position_order 
FROM user_roles 
WHERE name = 'Medico' OR name = 'Medicina'
ORDER BY position_order;

-- 3. Mostra tutti i ruoli per conferma
SELECT id, name, position_order 
FROM user_roles 
ORDER BY position_order;
