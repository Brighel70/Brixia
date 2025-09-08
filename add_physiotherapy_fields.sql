-- Script per aggiungere i campi fisioterapia alla tabella injury_activities
DO $$
BEGIN
    -- Aggiungi il campo massaggio se non esiste già
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'massaggio'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN massaggio BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN public.injury_activities.massaggio IS 'Indica se è stato effettuato massaggio';
    END IF;

    -- Aggiungi il campo tecar se non esiste già
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'tecar'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN tecar BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN public.injury_activities.tecar IS 'Indica se è stato effettuato trattamento Tecar';
    END IF;

    -- Aggiungi il campo laser se non esiste già
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'laser'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN laser BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN public.injury_activities.laser IS 'Indica se è stato effettuato trattamento Laser';
    END IF;
END $$;

-- Verifica che i campi siano stati aggiunti correttamente
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'injury_activities'
AND column_name IN ('massaggio', 'tecar', 'laser');
