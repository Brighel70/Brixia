-- Aggiungi la colonna 'invited' alla tabella events se non esiste
DO $$
BEGIN
    -- Controlla se la colonna 'invited' esiste già
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'events'
            AND column_name = 'invited'
            AND table_schema = 'public'
    ) THEN
        -- Aggiungi la colonna 'invited' come array di text
        ALTER TABLE public.events
        ADD COLUMN invited text[];
        
        RAISE NOTICE 'Colonna "invited" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "invited" esiste già nella tabella events';
    END IF;
END $$;








