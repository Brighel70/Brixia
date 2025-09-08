-- Script per aggiungere il campo staff_categories alla tabella people
-- Questo permette di salvare le categorie assegnate ai ruoli staff

-- 1. Aggiungi il campo staff_categories alla tabella people se non esiste già
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'people' 
        AND column_name = 'staff_categories'
    ) THEN
        ALTER TABLE people ADD COLUMN staff_categories jsonb;
        
        -- Aggiungi un commento per spiegare l'uso del campo
        COMMENT ON COLUMN people.staff_categories IS 'Array di ID delle categorie assegnate ai ruoli staff (JSON)';
    END IF;
END $$;

-- 2. Crea un indice per migliorare le performance delle ricerche per staff categories
CREATE INDEX IF NOT EXISTS idx_people_staff_categories ON people USING GIN (staff_categories);

-- 3. Verifica che il campo sia stato aggiunto correttamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'people' 
AND column_name = 'staff_categories';

-- 4. Mostra un esempio di come i dati saranno strutturati
-- (Questo è solo un esempio, non viene eseguito)
/*
-- Esempio: Assegnare categorie staff a una persona
UPDATE people 
SET staff_categories = '["category-id-1", "category-id-2"]'::jsonb
WHERE id = 'person-uuid-here';

-- Esempio: Rimuovere tutte le categorie staff
UPDATE people 
SET staff_categories = null
WHERE id = 'person-uuid-here';
*/
