-- Campi per la sezione Assicurazione / primo evento (comunicazioni assicurazione)
-- Data invio CSEN, Apertura sinistro, Liquidatore

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'csen_sent_date') THEN
    ALTER TABLE public.injury_activities ADD COLUMN csen_sent_date DATE;
    COMMENT ON COLUMN public.injury_activities.csen_sent_date IS 'Data invio documentazione a CSEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'claim_opening_date') THEN
    ALTER TABLE public.injury_activities ADD COLUMN claim_opening_date DATE;
    COMMENT ON COLUMN public.injury_activities.claim_opening_date IS 'Data apertura sinistro';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'adjuster') THEN
    ALTER TABLE public.injury_activities ADD COLUMN adjuster TEXT;
    COMMENT ON COLUMN public.injury_activities.adjuster IS 'Liquidatore (nome/referente assicurazione)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'claim_number_1') THEN
    ALTER TABLE public.injury_activities ADD COLUMN claim_number_1 TEXT;
    COMMENT ON COLUMN public.injury_activities.claim_number_1 IS 'Nr. Sinistro 1';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'claim_number_2') THEN
    ALTER TABLE public.injury_activities ADD COLUMN claim_number_2 TEXT;
    COMMENT ON COLUMN public.injury_activities.claim_number_2 IS 'Nr. Sinistro 2';
  END IF;
END $$;
