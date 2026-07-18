-- Aggiunge il campo "Fisioterapia" (checkbox) alla tabella injury_activities.
-- La scelta su questo checkbox determinerà operatività successive (es. pianificazione fisioterapia).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'richiesta_fisioterapia'
  ) THEN
    ALTER TABLE public.injury_activities
      ADD COLUMN richiesta_fisioterapia BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.injury_activities.richiesta_fisioterapia IS 'Se true, indica che dalla visita è emersa richiesta/prevista fisioterapia (checkbox in form Aggiungi Attività).';
  END IF;
END $$;
