-- Aggiungi il campo event_time alla tabella events
-- Esegui questo script nel tuo database Supabase

-- Verifica se il campo esiste già
SELECT CASE 
  WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'event_time' 
    AND table_schema = 'public'
  ) 
  THEN 'Campo event_time ESISTE' 
  ELSE 'Campo event_time NON ESISTE' 
END as status;

-- Aggiungi il campo se non esiste
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'event_time' 
    AND table_schema = 'public'
  ) THEN 
    ALTER TABLE public.events ADD COLUMN event_time TIME;
    RAISE NOTICE 'Campo event_time aggiunto';
  ELSE 
    RAISE NOTICE 'Campo event_time già esistente';
  END IF;
END $$;

-- Verifica la struttura aggiornata
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND table_schema = 'public'
ORDER BY ordinal_position;

