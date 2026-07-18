-- Controlla TUTTI i vincoli sulla tabella fee_assignments

-- 1. Controlla tutti i vincoli di controllo (CHECK)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
ORDER BY conname;

-- 2. Controlla anche i vincoli di unicità (UNIQUE)
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'u'
ORDER BY conname;

-- 3. Controlla la struttura della colonna installment_type
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'fee_assignments' 
AND column_name = 'installment_type';












