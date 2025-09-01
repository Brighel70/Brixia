-- Aggiungi campi per campionato e amichevole alla tabella events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_championship BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_friendly BOOLEAN DEFAULT false;

-- Verifica che i campi siano stati aggiunti
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('is_championship', 'is_friendly');

