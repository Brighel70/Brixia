-- Script per verificare la struttura della tabella sessions

-- 1. Verifica la struttura attuale della tabella sessions
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verifica se i campi start_time e end_time esistono
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      AND column_name = 'start_time' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo start_time ESISTE' 
    ELSE 'Campo start_time NON ESISTE' 
  END as start_time_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'sessions' 
      AND column_name = 'end_time' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo end_time ESISTE' 
    ELSE 'Campo end_time NON ESISTE' 
  END as end_time_status;








