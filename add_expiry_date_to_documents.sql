-- Aggiungi il campo expiry_date alla tabella documents
DO $$
BEGIN
    -- Controlla se la colonna expiry_date esiste già
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'documents'
            AND column_name = 'expiry_date'
            AND table_schema = 'public'
    ) THEN
        -- Aggiungi la colonna expiry_date
        ALTER TABLE public.documents
        ADD COLUMN expiry_date date;

        RAISE NOTICE 'Campo expiry_date aggiunto alla tabella documents';
    ELSE
        RAISE NOTICE 'Campo expiry_date esiste già nella tabella documents';
    END IF;
END $$;








