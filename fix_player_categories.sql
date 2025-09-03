-- Script per verificare e popolare la tabella player_categories
-- Questo script risolve il problema degli indicatori di presenza che non funzionano

-- 1. Verifica se ci sono giocatori
SELECT 'Giocatori totali:' as info, COUNT(*) as count FROM players;

-- 2. Verifica se ci sono categorie
SELECT 'Categorie totali:' as info, COUNT(*) as count FROM categories;

-- 3. Verifica se ci sono associazioni giocatori-categorie
SELECT 'Associazioni esistenti:' as info, COUNT(*) as count FROM player_categories;

-- 4. Mostra le prime 5 associazioni esistenti (se ce ne sono)
SELECT 'Prime 5 associazioni:' as info;
SELECT pc.*, p.first_name, p.last_name, c.name as category_name 
FROM player_categories pc
JOIN players p ON pc.player_id = p.id
JOIN categories c ON pc.category_id = c.id
LIMIT 5;

-- 5. Se non ci sono associazioni, creiamo delle associazioni di esempio
-- NOTA: Questo è solo un esempio - dovrai adattarlo ai tuoi dati reali

-- Prima verifichiamo se ci sono giocatori e categorie
DO $$
DECLARE
    player_count INTEGER;
    category_count INTEGER;
    association_count INTEGER;
BEGIN
    -- Conta giocatori e categorie
    SELECT COUNT(*) INTO player_count FROM players;
    SELECT COUNT(*) INTO category_count FROM categories;
    SELECT COUNT(*) INTO association_count FROM player_categories;
    
    RAISE NOTICE 'Giocatori: %, Categorie: %, Associazioni: %', player_count, category_count, association_count;
    
    -- Se non ci sono associazioni ma ci sono giocatori e categorie, creiamo delle associazioni di esempio
    IF association_count = 0 AND player_count > 0 AND category_count > 0 THEN
        RAISE NOTICE 'Creando associazioni di esempio...';
        
        -- Associa i primi 3 giocatori alla prima categoria
        INSERT INTO player_categories (player_id, category_id)
        SELECT p.id, c.id
        FROM players p
        CROSS JOIN categories c
        WHERE c.id = (SELECT id FROM categories ORDER BY name LIMIT 1)
        LIMIT 3;
        
        -- Associa i giocatori 4-6 alla seconda categoria
        INSERT INTO player_categories (player_id, category_id)
        SELECT p.id, c.id
        FROM players p
        CROSS JOIN categories c
        WHERE c.id = (SELECT id FROM categories ORDER BY name LIMIT 1 OFFSET 1)
        LIMIT 3;
        
        RAISE NOTICE 'Associazioni di esempio create!';
    ELSE
        RAISE NOTICE 'Associazioni già esistenti o mancano giocatori/categorie';
    END IF;
END $$;

-- 6. Verifica finale
SELECT 'Associazioni dopo fix:' as info, COUNT(*) as count FROM player_categories;

-- 7. Mostra le associazioni create
SELECT 'Associazioni create:' as info;
SELECT pc.*, p.first_name, p.last_name, c.name as category_name 
FROM player_categories pc
JOIN players p ON pc.player_id = p.id
JOIN categories c ON pc.category_id = c.id
ORDER BY c.name, p.last_name;




