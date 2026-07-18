-- Script per controllare le tabelle esistenti nel database

-- Lista tutte le tabelle nel database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Cerca tabelle che contengono "fee" o "assignment"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND (table_name LIKE '%fee%' OR table_name LIKE '%assignment%')
ORDER BY table_name;

-- Controlla anche le colonne per trovare la tabella corretta
SELECT table_name, column_name, data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND (column_name LIKE '%fee%' OR column_name LIKE '%assignment%' OR column_name LIKE '%installment%')
ORDER BY table_name, column_name;