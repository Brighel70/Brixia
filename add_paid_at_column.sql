-- Aggiungi la colonna paid_at alla tabella fee_assignments

-- Aggiungi colonna per la data di pagamento
ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Aggiungi commento per documentare la colonna
COMMENT ON COLUMN fee_assignments.paid_at IS 'Data e ora del pagamento della rata';












