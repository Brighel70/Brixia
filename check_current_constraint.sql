-- Controlla il vincolo attuale su installment_type

SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
AND conname LIKE '%installment_type%';












