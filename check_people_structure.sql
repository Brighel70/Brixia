-- Verifica la struttura della tabella people
SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'people'
ORDER BY ordinal_position;









