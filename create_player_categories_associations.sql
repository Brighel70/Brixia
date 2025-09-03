-- Script per creare le associazioni giocatori-categorie
-- Prima cancella tutto e poi ricrea

-- 1. Cancella tutte le associazioni esistenti
DELETE FROM player_categories;

-- 2. Ottieni tutti gli UUID delle categorie attive
SELECT 'Categorie attive trovate:' as info, COUNT(*) as count FROM categories WHERE active = true;

-- 3. Ottieni tutti i giocatori
SELECT 'Giocatori totali:' as info, COUNT(*) as count FROM players;

-- 4. Crea le associazioni usando una distribuzione ciclica
WITH 
-- Categorie attive ordinate
categories_ordered AS (
  SELECT id, code, name, sort, ROW_NUMBER() OVER (ORDER BY sort) as cat_num
  FROM categories 
  WHERE active = true
),
-- Giocatori ordinati
players_ordered AS (
  SELECT id, first_name, last_name, ROW_NUMBER() OVER (ORDER BY last_name, first_name) as player_num
  FROM players
),
-- Numero totale di categorie
total_categories AS (
  SELECT COUNT(*) as cat_count FROM categories_ordered
)
-- Inserisci le associazioni
INSERT INTO player_categories (player_id, category_id)
SELECT 
  p.id as player_id,
  c.id as category_id
FROM players_ordered p
CROSS JOIN total_categories tc
JOIN categories_ordered c ON ((p.player_num - 1) % tc.cat_count) + 1 = c.cat_num;

-- 5. Verifica il risultato
SELECT 
  'Risultato finale:' as info,
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
WHERE c.active = true
GROUP BY c.id, c.code, c.name, c.sort
ORDER BY c.sort;





