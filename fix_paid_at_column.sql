-- Script completo per risolvere il problema della colonna paid_at

-- 1. Verifica se la colonna esiste e aggiungila se necessario
DO $$ 
BEGIN
    -- Controlla se la colonna paid_at esiste
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'fee_assignments' 
        AND column_name = 'paid_at'
    ) THEN
        -- Aggiungi la colonna se non esiste
        ALTER TABLE fee_assignments 
        ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Colonna paid_at aggiunta alla tabella fee_assignments';
    ELSE
        RAISE NOTICE 'Colonna paid_at già esistente nella tabella fee_assignments';
    END IF;
END $$;

-- 2. Aggiungi commento per documentare la colonna
COMMENT ON COLUMN fee_assignments.paid_at IS 'Data e ora del pagamento della rata';

-- 3. Verifica la struttura della tabella
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'fee_assignments' 
ORDER BY ordinal_position;












