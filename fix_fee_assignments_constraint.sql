-- Rimuovi il vincolo UNIQUE che impedisce più assegnazioni per la stessa quota e persona
-- Questo è necessario per gestire le rate multiple

-- Prima rimuovi il vincolo esistente
ALTER TABLE fee_assignments DROP CONSTRAINT IF EXISTS fee_assignments_fee_id_person_id_key;

-- Aggiungi una colonna per identificare il numero della rata
ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT 1;

-- Aggiungi una colonna per identificare se è una rata o un pagamento completo
ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS installment_type VARCHAR(20) DEFAULT 'single' CHECK (installment_type IN ('single', 'installment'));

-- Crea un nuovo vincolo che permette più assegnazioni per la stessa quota e persona
-- ma solo una per ogni numero di rata
ALTER TABLE fee_assignments 
ADD CONSTRAINT fee_assignments_unique_installment 
UNIQUE(fee_id, person_id, installment_number);

-- Aggiorna le assegnazioni esistenti per impostare il tipo corretto
UPDATE fee_assignments 
SET installment_type = 'single', installment_number = 1 
WHERE installment_type IS NULL OR installment_number IS NULL;

-- Crea un indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_fee_assignments_installment ON fee_assignments(fee_id, person_id, installment_number);












