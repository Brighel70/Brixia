-- Aggiunge l'orario di ricontrollo / prossima fisioterapia a injury_activities
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'injury_activities'
          AND column_name = 'ricontrollo_time'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN ricontrollo_time TIME;
        COMMENT ON COLUMN public.injury_activities.ricontrollo_time IS 'Orario della prossima seduta (fisioterapia) o del ricontrollo';
    END IF;
END $$;
