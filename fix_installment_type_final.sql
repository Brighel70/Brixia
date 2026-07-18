-- Script finale per correggere il vincolo installment_type

-- 1. Prima controlla il vincolo attuale
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'fee_assignments'::regclass 
AND contype = 'c'
AND conname LIKE '%installment_type%';

-- 2. Elimina il vincolo esistente (se esiste)
DO $$
BEGIN
    -- Controlla se il vincolo esiste e, se sì, lo elimina
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fee_assignments_installment_type_check'
        AND conrelid = 'fee_assignments'::regclass
    ) THEN
        ALTER TABLE fee_assignments
        DROP CONSTRAINT fee_assignments_installment_type_check;
        RAISE NOTICE 'Vincolo fee_assignments_installment_type_check eliminato.';
    ELSE
        RAISE NOTICE 'Vincolo fee_assignments_installment_type_check non trovato.';
    END IF;

    -- Controlla se ci sono altri vincoli su installment_type e li elimina
    DECLARE
        constraint_name TEXT;
    BEGIN
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
    END;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Errore durante eliminazione vincoli: %', SQLERRM;
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
