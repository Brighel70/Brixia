-- Script per controllare la situazione dei ruoli Medicina e Medico
-- Esegui questo script nel tuo database Supabase

-- 1. Controlla tutti i ruoli che contengono "Medic" nel nome
SELECT id, name, position_order 
FROM user_roles 
WHERE name ILIKE '%medic%'
ORDER BY position_order;

-- 2. Controlla se ci sono persone che usano il ruolo "Medicina"
SELECT 
  p.id,
  p.full_name,
  p.staff_roles,
  ur.name as role_name
FROM people p
CROSS JOIN LATERAL jsonb_array_elements_text(p.staff_roles) as role_id
LEFT JOIN user_roles ur ON ur.id::text = role_id
WHERE ur.name = 'Medicina';

-- 3. Controlla se ci sono persone che usano il ruolo "Medico"
SELECT 
  p.id,
  p.full_name,
  p.staff_roles,
  ur.name as role_name
FROM people p
CROSS JOIN LATERAL jsonb_array_elements_text(p.staff_roles) as role_id
LEFT JOIN user_roles ur ON ur.id::text = role_id
WHERE ur.name = 'Medico';

-- 4. Mostra tutti i ruoli per vedere la situazione completa
SELECT id, name, position_order 
FROM user_roles 
ORDER BY position_order;
