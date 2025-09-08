-- Script per associare i giocatori a TUTTE le categorie usando i loro UUID reali

-- 1. Prima verifichiamo tutti gli UUID delle categorie attive
SELECT 
  'UUID delle categorie attive' as info,
  id,
  code,
  name,
  active,
  sort
FROM categories 
WHERE active = true
ORDER BY sort;

-- 2. Verifichiamo le associazioni esistenti
SELECT 
  'Associazioni esistenti' as info,
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
WHERE c.active = true
GROUP BY c.id, c.code, c.name, c.sort
ORDER BY c.sort;

-- 3. Ora associamo i giocatori a TUTTE le categorie attive
-- Dividendo equamente i giocatori tra le categorie

WITH 
-- Ottieni tutte le categorie attive con i loro UUID reali
active_categories AS (
  SELECT id, code, name, sort,
         ROW_NUMBER() OVER (ORDER BY sort) as category_order
  FROM categories 
  WHERE active = true
),
-- Ottieni tutti i giocatori
all_players AS (
  SELECT id, first_name, last_name, birth_year, injured, aggregated_seniores,
         ROW_NUMBER() OVER (ORDER BY last_name, first_name) as player_order
  FROM players
),
-- Calcola il numero di categorie e giocatori
stats AS (
  SELECT 
    (SELECT COUNT(*) FROM active_categories) as total_categories,
    (SELECT COUNT(*) FROM all_players) as total_players
)
-- Associa i giocatori alle categorie usando modulo per distribuzione equa
INSERT INTO player_categories (player_id, category_id)
SELECT 
  p.id as player_id,
  c.id as category_id
FROM all_players p
CROSS JOIN stats s
JOIN active_categories c ON (p.player_order - 1) % s.total_categories = (c.category_order - 1)
ON CONFLICT (player_id, category_id) DO NOTHING;

-- 4. Verifica finale delle associazioni
SELECT 
  'Associazioni finali per categoria' as info,
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
WHERE c.active = true
GROUP BY c.id, c.code, c.name, c.sort
ORDER BY c.sort;

-- 5. Mostra i giocatori per ogni categoria
SELECT 
  c.code as categoria,
  c.name as nome_categoria,
  p.first_name,
  p.last_name,
  p.birth_year,
  p.injured,
  p.aggregated_seniores
FROM categories c
JOIN player_categories pc ON c.id = pc.category_id
JOIN players p ON pc.player_id = p.id
WHERE c.active = true
ORDER BY c.sort, p.last_name, p.first_name;












