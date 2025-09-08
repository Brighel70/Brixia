-- Script per aggiungere i campi orario alla tabella sessions per gli allenamenti extra

-- Aggiungi campo start_time (orario inizio allenamento)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS start_time time;

-- Aggiungi campo end_time (orario fine allenamento)  
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS end_time time;

-- Verifica la struttura aggiornata
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND table_schema = 'public'
ORDER BY ordinal_position;









