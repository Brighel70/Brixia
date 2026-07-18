-- Aggiunge confirmation_status a injury_activities (usato da FlowMe per fisioterapia: eseguita, assente, altro).
-- Serve per la dashboard "Appuntamenti fissati": nascondere i passati già confermati.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE public.injury_activities ADD COLUMN confirmation_status text;
    COMMENT ON COLUMN public.injury_activities.confirmation_status IS 'Stato conferma fisioterapia: eseguita, assente, altro (vuoto = non confermato)';
  END IF;
END $$;
