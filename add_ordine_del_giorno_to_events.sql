-- Aggiunge la colonna 'ordine_del_giorno' alla tabella events per memorizzare i punti dell'agenda
-- Usata per eventi tipo "consiglio"

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'events'
          AND column_name = 'ordine_del_giorno'
    ) THEN
        ALTER TABLE public.events ADD COLUMN ordine_del_giorno text[];
        RAISE NOTICE 'Colonna "ordine_del_giorno" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "ordine_del_giorno" esiste già nella tabella events';
    END IF;
END $$;

COMMENT ON COLUMN public.events.ordine_del_giorno IS 'Array di punti dell''ordine del giorno per eventi consiglio';
