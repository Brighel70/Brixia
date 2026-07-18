-- Script per correggere il vincolo di controllo su installment_type

-- Prima controlla il vincolo esistente
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
AND conname LIKE '%installment_type%';

-- Se il vincolo esiste, rimuovilo
-- ALTER TABLE fee_assignments DROP CONSTRAINT IF EXISTS fee_assignments_installment_type_check;

-- Crea un nuovo vincolo che accetta i valori corretti
-- ALTER TABLE fee_assignments 
-- ADD CONSTRAINT fee_assignments_installment_type_check 
-- CHECK (installment_type IN ('down_payment', 'balance', 'partial', 'final'));

-- Verifica i valori attualmente presenti nella tabella
SELECT DISTINCT installment_type, COUNT(*) 
FROM fee_assignments 
GROUP BY installment_type;












