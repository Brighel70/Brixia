-- Aggiungi tutte le colonne mancanti alla tabella events
DO $$
BEGIN
    -- Aggiungi colonna 'invited' se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'invited' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.events ADD COLUMN invited text[];
        RAISE NOTICE 'Colonna "invited" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "invited" esiste già nella tabella events';
    END IF;

    -- Aggiungi colonna 'participants' se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'participants' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.events ADD COLUMN participants text[];
        RAISE NOTICE 'Colonna "participants" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "participants" esiste già nella tabella events';
    END IF;

    -- Aggiungi colonna 'verbale_pdfs' se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'verbale_pdfs' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.events ADD COLUMN verbale_pdfs text[];
        RAISE NOTICE 'Colonna "verbale_pdfs" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "verbale_pdfs" esiste già nella tabella events';
    END IF;

    -- Aggiungi colonna 'opponents' se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'opponents' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.events ADD COLUMN opponents text[];
        RAISE NOTICE 'Colonna "opponents" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "opponents" esiste già nella tabella events';
    END IF;

    -- Aggiungi colonna 'match_result' se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'events' AND column_name = 'match_result' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.events ADD COLUMN match_result text;
        RAISE NOTICE 'Colonna "match_result" aggiunta alla tabella events';
    ELSE
        RAISE NOTICE 'Colonna "match_result" esiste già nella tabella events';
    END IF;

    RAISE NOTICE 'Verifica e aggiunta colonne completata!';
END $$;
