-- Aggiungi il campo reminder_date alla tabella notes
DO $$
BEGIN
    -- Controlla se la colonna reminder_date esiste già
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notes'
            AND column_name = 'reminder_date'
            AND table_schema = 'public'
    ) THEN
        -- Aggiungi la colonna reminder_date
        ALTER TABLE public.notes
        ADD COLUMN reminder_date timestamp with time zone;

        -- Aggiungi commento per documentazione
        COMMENT ON COLUMN public.notes.reminder_date IS 'Data di promemoria/scadenza per la nota';

        -- Crea indice per performance su reminder_date
        CREATE INDEX IF NOT EXISTS idx_notes_reminder_date 
        ON public.notes(reminder_date);

        RAISE NOTICE 'Campo reminder_date aggiunto alla tabella notes';
    ELSE
        RAISE NOTICE 'Campo reminder_date esiste già nella tabella notes';
    END IF;
END $$;