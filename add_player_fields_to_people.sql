-- Script per aggiungere i campi player_categories e player_positions alla tabella people
-- Questo permette di salvare le categorie e posizioni dei giocatori direttamente nella tabella people

-- 1. Aggiungi il campo player_categories alla tabella people se non esiste già
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'people' 
        AND column_name = 'player_categories'
    ) THEN
        ALTER TABLE people ADD COLUMN player_categories jsonb;
        
        -- Aggiungi un commento per spiegare l'uso del campo
        COMMENT ON COLUMN people.player_categories IS 'Array di ID delle categorie assegnate al giocatore (JSON)';
    END IF;
END $$;

-- 2. Aggiungi il campo player_positions alla tabella people se non esiste già
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'people' 
        AND column_name = 'player_positions'
    ) THEN
        ALTER TABLE people ADD COLUMN player_positions jsonb;
        
        -- Aggiungi un commento per spiegare l'uso del campo
        COMMENT ON COLUMN people.player_positions IS 'Array di ID delle posizioni in campo del giocatore (JSON)';
    END IF;
END $$;

-- 3. Crea indici per migliorare le performance delle ricerche
CREATE INDEX IF NOT EXISTS idx_people_player_categories ON people USING GIN (player_categories);
CREATE INDEX IF NOT EXISTS idx_people_player_positions ON people USING GIN (player_positions);

-- 4. Verifica che i campi siano stati aggiunti correttamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'people' 
AND column_name IN ('player_categories', 'player_positions')
ORDER BY column_name;

-- 5. Mostra un esempio di come i dati saranno strutturati
-- (Questo è solo un esempio, non viene eseguito)
/*
-- Esempio: Assegnare categorie e posizioni a un giocatore
UPDATE people 
SET 
    player_categories = '["category-id-1", "category-id-2"]'::jsonb,
    player_positions = '["position-id-1", "position-id-2"]'::jsonb
WHERE id = 'person-uuid-here';

-- Esempio: Rimuovere tutte le categorie e posizioni
UPDATE people 
SET 
    player_categories = null,
    player_positions = null
WHERE id = 'person-uuid-here';
*/
