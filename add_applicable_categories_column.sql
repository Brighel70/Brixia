-- Script per aggiungere la colonna applicable_categories alla tabella fees

-- Aggiungi colonna per memorizzare le categorie applicabili
ALTER TABLE fees 
ADD COLUMN IF NOT EXISTS applicable_categories TEXT[];

-- Aggiungi commento per documentare la colonna
COMMENT ON COLUMN fees.applicable_categories IS 'Array delle categorie a cui si applica la quota (es. ["U6", "U8", "U12"])';

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'fees' 
AND column_name = 'applicable_categories';












