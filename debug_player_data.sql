-- Debug: Verifica i dati salvati per una persona specifica
-- Sostituisci 'PERSON_ID' con l'ID della persona che stai modificando

-- 1. Verifica i dati della persona
SELECT 
  id, 
  full_name, 
  given_name, 
  family_name,
  is_minor
FROM people 
WHERE id = 'PERSON_ID';

-- 2. Verifica i dati del giocatore
SELECT 
  p.id as player_id,
  p.person_id,
  p.first_name,
  p.last_name,
  p.player_position_id,
  p.player_position_id_2,
  pp1.name as ruolo_1,
  pp2.name as ruolo_2
FROM players p
LEFT JOIN player_positions pp1 ON p.player_position_id = pp1.id
LEFT JOIN player_positions pp2 ON p.player_position_id_2 = pp2.id
WHERE p.person_id = 'PERSON_ID';

-- 3. Verifica le categorie del giocatore
SELECT 
  pc.player_id,
  c.name as categoria
FROM player_categories pc
JOIN categories c ON pc.category_id = c.id
JOIN players p ON pc.player_id = p.id
WHERE p.person_id = 'PERSON_ID';

-- 4. Verifica tutte le posizioni disponibili
SELECT id, name, position_order FROM player_positions ORDER BY position_order;



