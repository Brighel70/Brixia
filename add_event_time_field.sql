-- Aggiungi il campo event_time alla tabella events se non esiste
DO $$
BEGIN
    -- Controlla se la colonna event_time esiste già
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
            AND column_name = 'event_time'
            AND table_schema = 'public'
    ) THEN
        -- Aggiungi la colonna event_time
        ALTER TABLE public.events 
        ADD COLUMN event_time time without time zone;
        
        RAISE NOTICE 'Campo event_time aggiunto alla tabella events';
    ELSE
        RAISE NOTICE 'Campo event_time esiste già nella tabella events';
    END IF;
END $$;