-- Verifica la struttura della tabella attendance
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'attendance'
ORDER BY ordinal_position;









