-- Script per controllare il vincolo di controllo su installment_type

-- Prima controlla se la tabella esiste
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fee_assignments'
) as table_exists;

-- Se la tabella esiste, controlla i vincoli di controllo
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
AND EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fee_assignments'
);

-- Controlla anche la struttura della colonna installment_type
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'fee_assignments' 
AND column_name = 'installment_type'
AND EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'fee_assignments'
);
