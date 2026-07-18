-- Script semplificato per correggere il vincolo installment_type

-- 1. Controlla il vincolo attuale
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
AND conname LIKE '%installment_type%';

-- 2. Elimina il vincolo principale (se esiste)
ALTER TABLE fee_assignments 
DROP CONSTRAINT IF EXISTS fee_assignments_installment_type_check;

-- 3. Aggiunge il nuovo vincolo con i valori corretti
ALTER TABLE fee_assignments
ADD CONSTRAINT fee_assignments_installment_type_check
CHECK (installment_type IN ('down_payment', 'balance'));

-- 4. Verifica che il vincolo sia stato aggiunto correttamente
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
AND conname LIKE '%installment_type%';












