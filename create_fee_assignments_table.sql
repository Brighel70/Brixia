-- Script per creare la tabella fee_assignments

-- Crea la tabella fee_assignments se non esiste
CREATE TABLE IF NOT EXISTS fee_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fee_id UUID NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Importo in centesimi
    due_date DATE NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method TEXT CHECK (payment_method IN ('contanti', 'bonifico')),
    installment_number INTEGER,
    installment_type TEXT CHECK (installment_type IN ('down_payment', 'balance', 'partial', 'final')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crea l'indice unico per evitare duplicati
CREATE UNIQUE INDEX IF NOT EXISTS fee_assignments_unique_installment 
ON fee_assignments (fee_id, person_id, installment_number);

-- Crea indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_fee_assignments_fee_id ON fee_assignments(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_person_id ON fee_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_status ON fee_assignments(status);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_due_date ON fee_assignments(due_date);

-- Aggiungi commenti per documentare la tabella
COMMENT ON TABLE fee_assignments IS 'Assegnazioni di quote ai giocatori con rate multiple';
COMMENT ON COLUMN fee_assignments.amount IS 'Importo della rata in centesimi';
COMMENT ON COLUMN fee_assignments.status IS 'Stato della rata: pending, paid, overdue';
COMMENT ON COLUMN fee_assignments.paid_at IS 'Data e ora del pagamento della rata';
COMMENT ON COLUMN fee_assignments.payment_method IS 'Metodo di pagamento: contanti o bonifico';
COMMENT ON COLUMN fee_assignments.installment_number IS 'Numero della rata (1, 2, 3, etc.)';
COMMENT ON COLUMN fee_assignments.installment_type IS 'Tipo di rata: down_payment, balance, partial, final';












