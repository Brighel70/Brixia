-- Aggiunge la colonna 'archived' alla tabella events
-- Quando un evento consiglio ha almeno un PDF verbale caricato, viene archiviato (archived=true)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'archived'
    ) THEN
        ALTER TABLE public.events ADD COLUMN archived boolean DEFAULT false;
        RAISE NOTICE 'Colonna "archived" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "archived" esiste già nella tabella events';
    END IF;
END $$;

COMMENT ON COLUMN public.events.archived IS 'Se true, l''evento è archiviato (es. consiglio con verbale PDF caricato)';
