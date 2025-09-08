-- Script per aggiungere i nuovi campi per tornei e partite alla tabella events

-- Aggiungi campo start_time (orario inizio)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS start_time time;

-- Aggiungi campo end_time (orario fine)  
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS end_time time;

-- Aggiungi campo opponents (array di avversari per tornei)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS opponents text[];

-- Aggiungi campo away_location (per trasferte)
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS away_location text;

-- Verifica la struttura aggiornata
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;











