-- Script per aggiungere il campo injured alla tabella people

-- 1. Aggiungi il campo injured alla tabella people
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS injured boolean NOT NULL DEFAULT false;

-- 2. Aggiungi un commento per spiegare il campo
COMMENT ON COLUMN public.people.injured IS 'Indica se la persona è attualmente infortunata';

-- 3. Verifica che il campo sia stato aggiunto
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'people' 
AND column_name = 'injured'
ORDER BY ordinal_position;

-- 4. Mostra alcuni esempi di dati
SELECT id, full_name, injured 
FROM public.people 
LIMIT 5;


