-- Tabelle per la gestione delle quote e costi della società sportiva

-- Tabella principale delle quote
CREATE TABLE IF NOT EXISTS fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('membership', 'trip', 'course', 'event', 'equipment', 'insurance', 'other')),
  amount INTEGER NOT NULL, -- Importo in centesimi (es: 5000 = 50.00€)
  currency VARCHAR(3) DEFAULT 'EUR',
  category VARCHAR(20) NOT NULL CHECK (category IN ('all', 'U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SERIE_C', 'SERIE_B', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE')),
  is_active BOOLEAN DEFAULT true,
  is_mandatory BOOLEAN DEFAULT false,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per le assegnazioni delle quote ai tesserati
CREATE TABLE IF NOT EXISTS fee_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_id UUID NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Importo specifico per questa assegnazione (può differire dalla quota base)
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date DATE NOT NULL,
  paid_date DATE,
  payment_method VARCHAR(50), -- 'cash', 'bank_transfer', 'card', 'other'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Rimosso constraint UNIQUE per permettere multiple assegnazioni per rate
);

-- Tabella per i pagamenti
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Importo pagato in centesimi
  payment_method VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  reference VARCHAR(255), -- Numero riferimento bonifico, ricevuta, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per i sconti e promozioni
CREATE TABLE IF NOT EXISTS fee_discounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value INTEGER NOT NULL, -- Percentuale (0-100) o importo fisso in centesimi
  applicable_fees UUID[] DEFAULT '{}', -- Array di fee_id a cui si applica (vuoto = tutti)
  applicable_categories VARCHAR(20)[] DEFAULT '{}', -- Categorie di persone a cui si applica
  valid_from DATE NOT NULL,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella per i template di quote (per creare rapidamente quote simili)
CREATE TABLE IF NOT EXISTS fee_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL, -- Dati del template (tipo, categoria, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_fees_type ON fees(type);
CREATE INDEX IF NOT EXISTS idx_fees_category ON fees(category);
CREATE INDEX IF NOT EXISTS idx_fees_active ON fees(is_active);
CREATE INDEX IF NOT EXISTS idx_assignments_person ON fee_assignments(person_id);
CREATE INDEX IF NOT EXISTS idx_assignments_fee ON fee_assignments(fee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON fee_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON fee_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_assignment ON payments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_fees_updated_at ON fees;
DROP TRIGGER IF EXISTS update_assignments_updated_at ON fee_assignments;

-- Create triggers
CREATE TRIGGER update_fees_updated_at BEFORE UPDATE ON fees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON fee_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserimento di quote predefinite per una società sportiva
INSERT INTO fees (name, description, type, amount, category, is_mandatory) VALUES
-- Quote di iscrizione per categorie specifiche
('Tessera Under 6', 'Tessera di iscrizione annuale Under 6', 'membership', 2000, 'U6', true),
('Tessera Under 8', 'Tessera di iscrizione annuale Under 8', 'membership', 2500, 'U8', true),
('Tessera Under 10', 'Tessera di iscrizione annuale Under 10', 'membership', 3000, 'U10', true),
('Tessera Under 12', 'Tessera di iscrizione annuale Under 12', 'membership', 3500, 'U12', true),
('Tessera Under 14', 'Tessera di iscrizione annuale Under 14', 'membership', 4000, 'U14', true),
('Tessera Under 16', 'Tessera di iscrizione annuale Under 16', 'membership', 4500, 'U16', true),
('Tessera Under 18', 'Tessera di iscrizione annuale Under 18', 'membership', 5000, 'U18', true),
('Tessera Serie C', 'Tessera di iscrizione annuale Serie C', 'membership', 5500, 'SERIE_C', true),
('Tessera Serie B', 'Tessera di iscrizione annuale Serie B', 'membership', 6000, 'SERIE_B', true),
('Tessera Seniores', 'Tessera di iscrizione annuale Seniores', 'membership', 6500, 'SENIORES', true),
('Tessera Poderosa', 'Tessera di iscrizione annuale Poderosa', 'membership', 4000, 'PODEROSA', true),
('Tessera GussagOld', 'Tessera di iscrizione annuale GussagOld', 'membership', 3500, 'GUSSAGOLD', true),
('Tessera Brixia Old', 'Tessera di iscrizione annuale Brixia Old', 'membership', 3000, 'BRIXIAOLD', true),
('Tessera Leonesse', 'Tessera di iscrizione annuale Leonesse', 'membership', 5000, 'LEONESSE', true),

-- Quote gite e trasferte
('Gita di Fine Anno', 'Contributo per gita di fine stagione', 'trip', 8000, 'all', false),
('Ritiro Estivo', 'Contributo per ritiro estivo', 'trip', 15000, 'all', false),
('Trasferta Nord Italia', 'Contributo per trasferte in Nord Italia', 'trip', 5000, 'all', false),
('Trasferta Sud Italia', 'Contributo per trasferte in Sud Italia', 'trip', 8000, 'all', false),

-- Quote corsi e formazione
('Corso Arbitri', 'Corso per diventare arbitro', 'course', 20000, 'SENIORES', false),
('Corso Allenatori', 'Corso per diventare allenatore', 'course', 25000, 'SENIORES', false),
('Corso Primo Soccorso', 'Corso di primo soccorso sportivo', 'course', 15000, 'all', false),
('Seminario Tecnico', 'Seminario di aggiornamento tecnico', 'course', 5000, 'all', false),

-- Quote eventi
('Torneo Estivo', 'Iscrizione al torneo estivo', 'event', 3000, 'all', false),
('Festa di Fine Anno', 'Contributo per festa di fine anno', 'event', 2000, 'all', false),
('Cena Sociale', 'Contributo per cena sociale', 'event', 2500, 'all', false),

-- Quote attrezzature
('Divisa Casa', 'Divisa per partite in casa', 'equipment', 4500, 'all', true),
('Divisa Trasferta', 'Divisa per partite in trasferta', 'equipment', 4500, 'all', true),
('Tuta da Allenamento', 'Tuta per allenamenti', 'equipment', 3500, 'all', false),
('Borsa Sportiva', 'Borsa con logo società', 'equipment', 2000, 'all', false),

-- Quote assicurazioni
('Assicurazione Infortuni', 'Copertura assicurativa per infortuni', 'insurance', 3000, 'all', true),
('Assicurazione Responsabilità Civile', 'Copertura RC per attività sportive', 'insurance', 2000, 'all', true),

-- Altre quote
('Contributo Impianti', 'Contributo per manutenzione impianti', 'other', 1000, 'all', false),
('Quota Sociale', 'Quota per attività sociali', 'other', 500, 'all', false);

-- Inserimento di template predefiniti
INSERT INTO fee_templates (name, description, template_data) VALUES
('Template Gita', 'Template per creare quote gite', '{"type": "trip", "category": "all", "is_mandatory": false, "currency": "EUR"}'),
('Template Corso', 'Template per creare quote corsi', '{"type": "course", "category": "adult", "is_mandatory": false, "currency": "EUR"}'),
('Template Evento', 'Template per creare quote eventi', '{"type": "event", "category": "all", "is_mandatory": false, "currency": "EUR"}'),
('Template Attrezzatura', 'Template per creare quote attrezzature', '{"type": "equipment", "category": "all", "is_mandatory": true, "currency": "EUR"}');

-- Vista per statistiche rapide
CREATE OR REPLACE VIEW fee_statistics AS
SELECT 
  f.type,
  f.category,
  COUNT(*) as total_fees,
  COUNT(CASE WHEN f.is_active THEN 1 END) as active_fees,
  COUNT(CASE WHEN f.is_mandatory THEN 1 END) as mandatory_fees,
  AVG(f.amount) as avg_amount,
  MIN(f.amount) as min_amount,
  MAX(f.amount) as max_amount
FROM fees f
GROUP BY f.type, f.category
ORDER BY f.type, f.category;

-- Vista per assegnazioni con dettagli
CREATE OR REPLACE VIEW assignment_details AS
SELECT 
  fa.id,
  fa.person_id,
  p.given_name as first_name,
  p.family_name as last_name,
  f.name as fee_name,
  f.type as fee_type,
  fa.amount,
  fa.status,
  fa.due_date,
  fa.paid_date,
  fa.payment_method,
  fa.notes,
  fa.created_at,
  COALESCE(SUM(pay.amount), 0) as paid_amount
FROM fee_assignments fa
JOIN people p ON fa.person_id = p.id
JOIN fees f ON fa.fee_id = f.id
LEFT JOIN payments pay ON fa.id = pay.assignment_id
GROUP BY fa.id, fa.person_id, p.given_name, p.family_name, f.name, f.type, fa.amount, fa.status, fa.due_date, fa.paid_date, fa.payment_method, fa.notes, fa.created_at
ORDER BY fa.created_at DESC;

-- Funzione RPC per ottenere assegnazioni con pagamenti
CREATE OR REPLACE FUNCTION get_assignments_with_payments()
RETURNS TABLE (
  id UUID,
  fee_id UUID,
  person_id UUID,
  amount INTEGER,
  status VARCHAR(20),
  due_date DATE,
  paid_date DATE,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  installment_number INTEGER,
  installment_type VARCHAR(20),
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_amount BIGINT,
  fees JSONB,
  people JSONB
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.id,
    fa.fee_id,
    fa.person_id,
    fa.amount,
    fa.status,
    fa.due_date,
    fa.paid_date,
    fa.payment_method,
    fa.notes,
    fa.created_at,
    fa.installment_number,
    fa.installment_type,
    fa.paid_at,
    COALESCE(SUM(pay.amount), 0) as paid_amount,
    to_jsonb(f.*) as fees,
    to_jsonb(per.*) as people
  FROM fee_assignments fa
  JOIN people per ON fa.person_id = per.id
  JOIN fees f ON fa.fee_id = f.id
  LEFT JOIN payments pay ON fa.id = pay.assignment_id
  GROUP BY fa.id, fa.fee_id, fa.person_id, fa.amount, fa.status, fa.due_date, fa.paid_date, fa.payment_method, fa.notes, fa.created_at, fa.installment_number, fa.installment_type, fa.paid_at, f.*, per.*
  ORDER BY fa.created_at DESC;
END;
$$;
