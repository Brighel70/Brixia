-- Script per eliminare il ruolo "Medicina" e convertire tutti gli utenti a "Medico"
-- Esegui questo script nel tuo database Supabase

-- 1. Prima controlla chi usa il ruolo "Medicina"
SELECT 
  p.id,
  p.full_name,
  p.staff_roles
FROM people p
WHERE p.staff_roles::text LIKE '%1339762f-9220-49da-9ac3-724d9a50d233%';

-- 2. Aggiorna tutte le persone che hanno "Medicina" per usare "Medico" invece
UPDATE people 
SET staff_roles = (
  SELECT jsonb_agg(
    CASE 
      WHEN value::text = '"1339762f-9220-49da-9ac3-724d9a50d233"' 
      THEN '"8de30e96-1de9-44da-ab59-157f1de47f6d"'::jsonb
      ELSE value
    END
  )
  FROM jsonb_array_elements(staff_roles)
)
WHERE staff_roles::text LIKE '%1339762f-9220-49da-9ac3-724d9a50d233%';

-- 3. Elimina il ruolo "Medicina" dalla tabella user_roles
DELETE FROM user_roles 
WHERE id = '1339762f-9220-49da-9ac3-724d9a50d233';

-- 4. Verifica che l'operazione sia andata a buon fine
SELECT 
  p.id,
  p.full_name,
  p.staff_roles,
  ur.name as role_name
FROM people p
CROSS JOIN LATERAL jsonb_array_elements_text(p.staff_roles) as role_id
LEFT JOIN user_roles ur ON ur.id::text = role_id
WHERE ur.name = 'Medico'
ORDER BY p.full_name;

-- 5. Mostra tutti i ruoli rimanenti
SELECT id, name, position_order 
FROM user_roles 
ORDER BY position_order;

