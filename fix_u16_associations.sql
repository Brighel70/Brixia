-- Script per verificare e correggere le associazioni U16

-- 1. Verifica l'UUID effettivo della categoria U16
SELECT 
  'UUID U16 nel database' as info,
  id,
  code,
  name,
  active
FROM categories 
WHERE code = 'U16';

-- 2. Verifica se ci sono associazioni per U16
SELECT 
  'Associazioni esistenti per U16' as info,
  pc.player_id,
  pc.category_id,
  c.code as categoria_code,
  p.first_name,
  p.last_name
FROM player_categories pc
JOIN categories c ON pc.category_id = c.id
JOIN players p ON pc.player_id = p.id
WHERE c.code = 'U16';

-- 3. Se non ci sono associazioni, le creiamo con l'UUID corretto
WITH u16_category AS (
  SELECT id FROM categories WHERE code = 'U16' AND active = true
),
-- Prendiamo i giocatori che dovrebbero essere in U16 (dal risultato precedente)
u16_players AS (
  SELECT id, first_name, last_name
  FROM players 
  WHERE (first_name = 'Claudio' AND last_name = 'Bruno') OR
        (first_name = 'Alessio' AND last_name = 'Galli') OR
        (first_name = 'Vincenzo' AND last_name = 'Marino') OR
        (first_name = 'Roberto' AND last_name = 'Rosa')
)
-- Inseriamo le associazioni
INSERT INTO player_categories (player_id, category_id)
SELECT 
  p.id as player_id,
  c.id as category_id
FROM u16_players p
CROSS JOIN u16_category c
ON CONFLICT (player_id, category_id) DO NOTHING;

-- 4. Verifica finale delle associazioni U16
SELECT 
  'Associazioni finali per U16' as info,
  pc.player_id,
  pc.category_id,
  c.code as categoria_code,
  p.first_name,
  p.last_name
FROM player_categories pc
JOIN categories c ON pc.category_id = c.id
JOIN players p ON pc.player_id = p.id
WHERE c.code = 'U16';

-- 5. Conta totale giocatori per U16
SELECT 
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
WHERE c.code = 'U16'
GROUP BY c.id, c.code, c.name;











