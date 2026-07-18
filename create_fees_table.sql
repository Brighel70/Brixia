-- Script per creare la tabella fees

-- Crea la tabella fees se non esiste
CREATE TABLE IF NOT EXISTS fees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('membership', 'trip', 'course', 'event', 'equipment', 'insurance', 'other')),
    amount INTEGER NOT NULL, -- Importo in centesimi
    currency TEXT DEFAULT 'EUR',
    category TEXT NOT NULL CHECK (category IN ('all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SERIE_C', 'SERIE_B', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE')),
    is_active BOOLEAN DEFAULT true,
    is_mandatory BOOLEAN DEFAULT false,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Nuovi campi per modalità di pagamento
    payment_mode TEXT CHECK (payment_mode IN ('single', 'installments')),
    installment_count INTEGER,
    installment_frequency TEXT CHECK (installment_frequency IN ('monthly', 'weekly')),
    installment_start_date DATE,
    -- Configurazione manuale delle rate (JSONB)
    installments JSONB
);

-- Crea indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(type);
CREATE INDEX IF NOT EXISTS idx_fees_category ON fees(category);
CREATE INDEX IF NOT EXISTS idx_fees_is_active ON fees(is_active);
CREATE INDEX IF NOT EXISTS idx_fees_is_mandatory ON fees(is_mandatory);

-- Aggiungi commenti per documentare la tabella
COMMENT ON TABLE fees IS 'Tipologie di quote per le diverse categorie';
COMMENT ON COLUMN fees.amount IS 'Importo della quota in centesimi';
COMMENT ON COLUMN fees.type IS 'Tipo di quota: membership, trip, course, event, equipment, insurance, other';
COMMENT ON COLUMN fees.category IS 'Categoria destinataria della quota';
COMMENT ON COLUMN fees.payment_mode IS 'Modalità di pagamento: single o installments';
COMMENT ON COLUMN fees.installments IS 'Configurazione manuale delle rate in formato JSON';












