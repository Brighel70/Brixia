-- Script completo per creare tutto il database necessario

-- 1. Prima controlla le tabelle esistenti
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Crea la tabella people (se non esiste)
CREATE TABLE IF NOT EXISTS people (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    date_of_birth DATE,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Italy',
    is_minor BOOLEAN DEFAULT false,
    is_player BOOLEAN DEFAULT false,
    is_staff BOOLEAN DEFAULT false,
    is_tutor BOOLEAN DEFAULT false,
    category TEXT CHECK (category IN ('U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SERIE_C', 'SERIE_B', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE')),
    position TEXT,
    jersey_number INTEGER,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    medical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Crea la tabella fees
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

-- 4. Crea la tabella fee_assignments (dipende da fees e people)
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

-- 5. Crea indici per people
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
CREATE INDEX IF NOT EXISTS idx_people_is_minor ON people(is_minor);
CREATE INDEX IF NOT EXISTS idx_people_is_player ON people(is_player);
CREATE INDEX IF NOT EXISTS idx_people_is_staff ON people(is_staff);
CREATE INDEX IF NOT EXISTS idx_people_category ON people(category);

-- 6. Crea indici per fees
CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(type);
CREATE INDEX IF NOT EXISTS idx_fees_category ON fees(category);
CREATE INDEX IF NOT EXISTS idx_fees_is_active ON fees(is_active);
CREATE INDEX IF NOT EXISTS idx_fees_is_mandatory ON fees(is_mandatory);

-- 7. Crea indici per fee_assignments
CREATE UNIQUE INDEX IF NOT EXISTS fee_assignments_unique_installment 
ON fee_assignments (fee_id, person_id, installment_number);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_fee_id ON fee_assignments(fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_person_id ON fee_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_status ON fee_assignments(status);
CREATE INDEX IF NOT EXISTS idx_fee_assignments_due_date ON fee_assignments(due_date);

-- 8. Aggiungi commenti
COMMENT ON TABLE people IS 'Persone (giocatori, staff, tutor) del club';
COMMENT ON COLUMN people.category IS 'Categoria del giocatore';
COMMENT ON COLUMN people.is_minor IS 'Se è minorenne';
COMMENT ON COLUMN people.is_player IS 'Se è un giocatore';
COMMENT ON COLUMN people.is_staff IS 'Se è membro dello staff';
COMMENT ON COLUMN people.is_tutor IS 'Se è un tutor';

COMMENT ON TABLE fees IS 'Tipologie di quote per le diverse categorie';
COMMENT ON COLUMN fees.amount IS 'Importo della quota in centesimi';
COMMENT ON COLUMN fees.type IS 'Tipo di quota: membership, trip, course, event, equipment, insurance, other';
COMMENT ON COLUMN fees.category IS 'Categoria destinataria della quota';
COMMENT ON COLUMN fees.payment_mode IS 'Modalità di pagamento: single o installments';
COMMENT ON COLUMN fees.installments IS 'Configurazione manuale delle rate in formato JSON';

COMMENT ON TABLE fee_assignments IS 'Assegnazioni di quote ai giocatori con rate multiple';
COMMENT ON COLUMN fee_assignments.amount IS 'Importo della rata in centesimi';
COMMENT ON COLUMN fee_assignments.status IS 'Stato della rata: pending, paid, overdue';
COMMENT ON COLUMN fee_assignments.paid_at IS 'Data e ora del pagamento della rata';
COMMENT ON COLUMN fee_assignments.payment_method IS 'Metodo di pagamento: contanti o bonifico';
COMMENT ON COLUMN fee_assignments.installment_number IS 'Numero della rata (1, 2, 3, etc.)';
COMMENT ON COLUMN fee_assignments.installment_type IS 'Tipo di rata: down_payment, balance, partial, final';

-- 9. Verifica che le tabelle siano state create
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND table_name IN ('people', 'fees', 'fee_assignments')
ORDER BY table_name;












