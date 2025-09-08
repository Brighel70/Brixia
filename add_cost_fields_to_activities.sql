-- Script per aggiungere i campi mancanti alla tabella injury_activities
-- Questi campi sono necessari per gestire tutte le funzionalità delle attività

-- Aggiungi il campo amount (importo)
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2);

-- Aggiungi il campo currency (valuta)
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';

-- Aggiungi il campo test_type (tipo di esame)
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS test_type TEXT;

-- Aggiungi i campi per le autorizzazioni
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS can_play_field BOOLEAN DEFAULT FALSE;

ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS can_play_gym BOOLEAN DEFAULT FALSE;

-- Aggiungi il campo per la previsione di stop
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS expected_stop_days INTEGER;

-- Aggiungi il campo ricontrollo
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS ricontrollo DATE;

-- Aggiungi i campi per i trattamenti di fisioterapia
ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS massaggio BOOLEAN DEFAULT FALSE;

ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS tecar BOOLEAN DEFAULT FALSE;

ALTER TABLE public.injury_activities 
ADD COLUMN IF NOT EXISTS laser BOOLEAN DEFAULT FALSE;

-- Aggiungi commenti per documentare i campi
COMMENT ON COLUMN public.injury_activities.amount IS 'Importo del costo o rimborso dell''attività';
COMMENT ON COLUMN public.injury_activities.currency IS 'Valuta utilizzata (EUR, USD, etc.)';
COMMENT ON COLUMN public.injury_activities.test_type IS 'Tipo di esame per attività di test';
COMMENT ON COLUMN public.injury_activities.can_play_field IS 'Autorizzazione a giocare in campo';
COMMENT ON COLUMN public.injury_activities.can_play_gym IS 'Autorizzazione a giocare in palestra';
COMMENT ON COLUMN public.injury_activities.expected_stop_days IS 'Giorni di stop previsti';
COMMENT ON COLUMN public.injury_activities.ricontrollo IS 'Data del prossimo ricontrollo';
COMMENT ON COLUMN public.injury_activities.massaggio IS 'Trattamento massaggio per fisioterapia';
COMMENT ON COLUMN public.injury_activities.tecar IS 'Trattamento tecar per fisioterapia';
COMMENT ON COLUMN public.injury_activities.laser IS 'Trattamento laser per fisioterapia';

-- Verifica che i campi siano stati aggiunti correttamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'injury_activities' 
AND column_name IN ('amount', 'currency')
ORDER BY column_name;
