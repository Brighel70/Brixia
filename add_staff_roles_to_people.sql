-- Script per aggiungere il campo staff_roles alla tabella people
-- Questo permette di salvare i ruoli staff selezionati per ogni persona

-- 1. Aggiungi il campo staff_roles alla tabella people se non esiste già
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'people' 
        AND column_name = 'staff_roles'
    ) THEN
        ALTER TABLE people ADD COLUMN staff_roles jsonb;
        
        -- Aggiungi un commento per spiegare l'uso del campo
        COMMENT ON COLUMN people.staff_roles IS 'Array di ID dei ruoli staff assegnati a questa persona (JSON)';
    END IF;
END $$;

-- 2. Crea un indice per migliorare le performance delle ricerche per staff roles
CREATE INDEX IF NOT EXISTS idx_people_staff_roles ON people USING GIN (staff_roles);

-- 3. Verifica che il campo sia stato aggiunto correttamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'people' 
AND column_name = 'staff_roles';

-- 4. Mostra un esempio di come i dati saranno strutturati
-- (Questo è solo un esempio, non viene eseguito)
/*
-- Esempio: Assegnare ruoli staff a una persona
UPDATE people 
SET staff_roles = '["role-id-1", "role-id-2"]'::jsonb
WHERE id = 'person-uuid-here';

-- Esempio: Rimuovere tutti i ruoli staff
UPDATE people 
SET staff_roles = null
WHERE id = 'person-uuid-here';
*/

