-- Script per aggiungere i campi di chiusura infortunio alla tabella injuries
ALTER TABLE public.injuries 
ADD COLUMN IF NOT EXISTS injury_closed_date date,
ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

-- Aggiungi commenti
COMMENT ON COLUMN public.injuries.injury_closed_date IS 'Data di chiusura dell''infortunio (quando guarito)';
COMMENT ON COLUMN public.injuries.is_closed IS 'Indica se l''infortunio è chiuso/guarito';

-- Aggiorna gli infortuni esistenti: se current_status = 'Guarito', imposta is_closed = true
UPDATE public.injuries 
SET is_closed = true, 
    injury_closed_date = updated_at::date
WHERE current_status = 'Guarito';

-- Verifica i campi aggiunti
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'injuries' 
AND column_name IN ('injury_closed_date', 'is_closed')
ORDER BY ordinal_position;

-- Mostra alcuni esempi
SELECT id, injury_type, current_status, is_closed, injury_closed_date, injury_date
FROM public.injuries 
LIMIT 5;

