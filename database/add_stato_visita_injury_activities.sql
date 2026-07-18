-- Aggiunge il campo stato_visita (eseguito / assente) per le visite.
-- Usato nel form attività dopo Data e Orario.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'stato_visita'
  ) THEN
    ALTER TABLE public.injury_activities
      ADD COLUMN stato_visita TEXT NULL
      CONSTRAINT injury_activities_stato_visita_check CHECK (stato_visita IS NULL OR stato_visita IN ('eseguito', 'assente'));
    COMMENT ON COLUMN public.injury_activities.stato_visita IS 'Stato della visita: eseguito (effettuata) o assente (paziente assente).';
  END IF;
END $$;
