-- Script per aggiungere la colonna payment_method alla tabella fee_assignments

-- Aggiungi colonna per il metodo di pagamento
ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);

-- Aggiungi commento per documentare la colonna
COMMENT ON COLUMN fee_assignments.payment_method IS 'Metodo di pagamento: contanti, bonifico, etc.';

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fee_assignments' 
AND column_name = 'payment_method';












