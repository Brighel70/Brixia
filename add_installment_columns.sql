-- Aggiungi colonne per la configurazione delle rate nella tabella fees
ALTER TABLE fees 
ADD COLUMN IF NOT EXISTS payment_mode TEXT CHECK (payment_mode IN ('single', 'installments')),
ADD COLUMN IF NOT EXISTS installment_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS installment_frequency TEXT CHECK (installment_frequency IN ('monthly', 'weekly')),
ADD COLUMN IF NOT EXISTS installment_start_date DATE,
ADD COLUMN IF NOT EXISTS installments JSONB DEFAULT '[]'::jsonb;

-- Aggiorna le quote esistenti per impostare il valore di default
UPDATE fees 
SET payment_mode = 'single' 
WHERE payment_mode IS NULL;

-- Crea un indice per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_fees_payment_mode ON fees(payment_mode);
CREATE INDEX IF NOT EXISTS idx_fees_installments ON fees USING GIN (installments);












