-- Script per aggiungere il campo ricontrollo alla tabella injury_activities
DO $$
BEGIN
    -- Aggiungi il campo ricontrollo se non esiste già
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'ricontrollo'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN ricontrollo DATE;
        COMMENT ON COLUMN public.injury_activities.ricontrollo IS 'Data di ricontrollo per l''atleta';
    END IF;
END $$;

-- Verifica che il campo sia stato aggiunto correttamente
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'injury_activities'
AND column_name = 'ricontrollo';

