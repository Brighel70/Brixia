-- Script per verificare e correggere le associazioni Serie B

-- 1. Verifica l'UUID effettivo della categoria Serie B
SELECT 
  'UUID Serie B nel database' as info,
  id,
  code,
  name,
  active
FROM categories 
WHERE code = 'SERIE_B';

-- 2. Verifica se ci sono associazioni per Serie B
SELECT 
  'Associazioni esistenti per Serie B' as info,
  pc.player_id,
  pc.category_id,
  c.code as categoria_code,
  p.first_name,
  p.last_name
FROM player_categories pc
JOIN categories c ON pc.category_id = c.id
JOIN players p ON pc.player_id = p.id
WHERE c.code = 'SERIE_B';

-- 3. Se non ci sono associazioni, le creiamo con l'UUID corretto
-- Prima otteniamo l'UUID corretto della categoria Serie B
WITH serie_b_category AS (
  SELECT id FROM categories WHERE code = 'SERIE_B' AND active = true
),
-- Prendiamo i primi 4 giocatori (o quanti ne servono per Serie B)
serie_b_players AS (
  SELECT id, first_name, last_name
  FROM players 
  ORDER BY last_name, first_name
  LIMIT 4
)
-- Inseriamo le associazioni
INSERT INTO player_categories (player_id, category_id)
SELECT 
  p.id as player_id,
  c.id as category_id
FROM serie_b_players p
CROSS JOIN serie_b_category c
ON CONFLICT (player_id, category_id) DO NOTHING;

-- 4. Verifica finale delle associazioni
SELECT 
  'Associazioni finali per Serie B' as info,
  pc.player_id,
  pc.category_id,
  c.code as categoria_code,
  p.first_name,
  p.last_name
FROM player_categories pc
JOIN categories c ON pc.category_id = c.id
JOIN players p ON pc.player_id = p.id
WHERE c.code = 'SERIE_B';

-- 5. Conta totale giocatori per categoria
SELECT 
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
WHERE c.active = true
GROUP BY c.id, c.code, c.name, c.sort
ORDER BY c.sort;












