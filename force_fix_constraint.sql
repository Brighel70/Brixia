-- Script per forzare la correzione del vincolo installment_type

-- 1. Prima mostra tutti i vincoli attuali
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
ORDER BY conname;

-- 2. Elimina TUTTI i vincoli di controllo su installment_type
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Trova tutti i vincoli che contengono installment_type
    FOR constraint_name IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'fee_assignments'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%installment_type%'
    ) LOOP
        EXECUTE 'ALTER TABLE fee_assignments DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Vincolo % eliminato.', constraint_name;
    END LOOP;
END $$;

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

-- 5. Testa il vincolo con un valore valido
INSERT INTO fee_assignments (fee_id, person_id, amount, due_date, installment_number, installment_type)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 100, '2025-01-01', 1, 'down_payment');

-- 6. Se il test funziona, elimina il record di test
DELETE FROM fee_assignments WHERE fee_id = '00000000-0000-0000-0000-000000000000';












