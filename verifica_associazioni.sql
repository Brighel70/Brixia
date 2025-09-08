-- Script per verificare se le associazioni giocatori-categorie esistono

-- 1. Conta i giocatori
SELECT 'Giocatori totali:' as info, COUNT(*) as count FROM players;

-- 2. Conta le categorie attive
SELECT 'Categorie attive:' as info, COUNT(*) as count FROM categories WHERE active = true;

-- 3. Conta le associazioni
SELECT 'Associazioni totali:' as info, COUNT(*) as count FROM player_categories;

-- 4. Verifica le associazioni per categoria
SELECT 
  'Associazioni per categoria:' as info,
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
WHERE c.active = true
GROUP BY c.id, c.code, c.name, c.sort
ORDER BY c.sort;

-- 5. Verifica alcuni giocatori specifici
SELECT 
  'Giocatori con associazioni:' as info,
  p.first_name,
  p.last_name,
  p.fir_code,
  c.code as categoria
FROM players p
LEFT JOIN player_categories pc ON p.id = pc.player_id
LEFT JOIN categories c ON pc.category_id = c.id
WHERE p.fir_code IN ('FIR-U6-LR-001', 'FIR-U8-AR-006', 'FIR-U16-CS-023', 'FIR-SB-FC-033')
ORDER BY p.fir_code;

-- 6. Verifica se ci sono giocatori senza associazioni
SELECT 
  'Giocatori senza associazioni:' as info,
  COUNT(*) as count
FROM players p
LEFT JOIN player_categories pc ON p.id = pc.player_id
WHERE pc.player_id IS NULL;











