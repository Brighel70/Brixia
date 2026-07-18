-- Campi per il modal attività Infortuni (web app + FlowMe)
-- OPZIONALE: esegui solo se il tuo schema injury_activities NON ha già
-- cost, cost_currency, recheck_date, activity_time. Se li hai già (come nello schema attuale), non serve.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'cost') THEN
    ALTER TABLE public.injury_activities ADD COLUMN cost NUMERIC(10,2);
    COMMENT ON COLUMN public.injury_activities.cost IS 'Costo attività';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'cost_currency') THEN
    ALTER TABLE public.injury_activities ADD COLUMN cost_currency TEXT DEFAULT 'EUR';
    COMMENT ON COLUMN public.injury_activities.cost_currency IS 'Valuta: EUR, USD, GBP';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'recheck_date') THEN
    ALTER TABLE public.injury_activities ADD COLUMN recheck_date DATE;
    COMMENT ON COLUMN public.injury_activities.recheck_date IS 'Data prevista ricontrollo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'activity_time') THEN
    ALTER TABLE public.injury_activities ADD COLUMN activity_time TIME;
    COMMENT ON COLUMN public.injury_activities.activity_time IS 'Orario appuntamento';
  END IF;
END $$;
