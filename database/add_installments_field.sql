-- Aggiunge il campo installments alla tabella fees per supportare il pagamento a rate

-- Aggiungi il campo installments come JSONB per memorizzare le configurazioni delle rate
ALTER TABLE fees ADD COLUMN IF NOT EXISTS installments JSONB DEFAULT NULL;

-- Aggiungi il campo payment_mode per distinguere tra pagamento singolo e rate
ALTER TABLE fees ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(20) DEFAULT 'single' CHECK (payment_mode IN ('single', 'installments'));

-- Aggiungi il campo installment_number alla tabella fee_assignments se non esiste già
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT NULL;

-- Aggiungi il campo installment_type alla tabella fee_assignments se non esiste già  
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS installment_type VARCHAR(20) DEFAULT NULL CHECK (installment_type IN ('acconto', 'saldo', 'rata'));

-- Aggiungi il campo paid_at alla tabella fee_assignments se non esiste già
ALTER TABLE fee_assignments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Aggiorna alcune quote esistenti per avere il pagamento a rate configurato
UPDATE fees 
SET 
  payment_mode = 'installments',
  installments = '[
    {
      "amount": 50,
      "due_date": "2025-07-07", 
      "notes": "Acconto",
      "installment_number": 1,
      "installment_type": "acconto"
    },
    {
      "amount": 100,
      "due_date": "2025-09-30",
      "notes": "Acconto", 
      "installment_number": 2,
      "installment_type": "acconto"
    },
    {
      "amount": 150,
      "due_date": "2025-12-15",
      "notes": "Saldo",
      "installment_number": 3, 
      "installment_type": "saldo"
    }
  ]'::jsonb
WHERE name = 'Quota di Iscrizione annuale' AND category = 'U18';

-- Commento per spiegare la struttura delle rate
COMMENT ON COLUMN fees.installments IS 'Configurazione delle rate per il pagamento a rate. Array JSON con oggetti contenenti: amount (in euro), due_date, notes, installment_number, installment_type';
COMMENT ON COLUMN fees.payment_mode IS 'Modalità di pagamento: single (pagamento unico) o installments (pagamento a rate)';
COMMENT ON COLUMN fee_assignments.installment_number IS 'Numero della rata (1, 2, 3, etc.)';
COMMENT ON COLUMN fee_assignments.installment_type IS 'Tipo di rata: acconto, saldo, rata';
COMMENT ON COLUMN fee_assignments.paid_at IS 'Data e ora del pagamento';










