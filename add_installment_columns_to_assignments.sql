-- Aggiungi le colonne mancanti per le rate nella tabella fee_assignments

-- Aggiungi colonna per il numero della rata
ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT 1;

-- Aggiungi colonna per il tipo di rata
ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS installment_type VARCHAR(20) DEFAULT 'single' CHECK (installment_type IN ('single', 'installment'));

-- Aggiorna le assegnazioni esistenti
UPDATE fee_assignments 
SET installment_number = 1, installment_type = 'single' 
WHERE installment_number IS NULL OR installment_type IS NULL;












