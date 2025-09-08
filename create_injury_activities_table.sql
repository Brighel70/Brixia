-- Tabella per le attività degli infortuni
CREATE TABLE IF NOT EXISTS injury_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    injury_id UUID NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'medical_visit', 'physiotherapy', 'test', 'note', 'insurance_refund', 'equipment_purchase', 'expenses', 'other'
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    operator_name VARCHAR(255), -- Nome del medico, fisioterapista, etc.
    duration_minutes INTEGER, -- Per fisioterapia
    description TEXT, -- Descrizione dell'attività
    notes TEXT, -- Note aggiuntive
    amount DECIMAL(10,2), -- Per spese, rimborsi, acquisti
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'Sistema'
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_injury_activities_injury_id ON injury_activities(injury_id);
CREATE INDEX IF NOT EXISTS idx_injury_activities_activity_date ON injury_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_injury_activities_type ON injury_activities(activity_type);

-- RLS (Row Level Security)
ALTER TABLE injury_activities ENABLE ROW LEVEL SECURITY;

-- Policy per permettere lettura e scrittura a tutti gli utenti autenticati
CREATE POLICY "Allow all operations for authenticated users" ON injury_activities
    FOR ALL USING (auth.role() = 'authenticated');

-- Commenti per documentazione
COMMENT ON TABLE injury_activities IS 'Attività e annotazioni relative agli infortuni';
COMMENT ON COLUMN injury_activities.activity_type IS 'Tipo di attività: medical_visit, physiotherapy, test, note, insurance_refund, equipment_purchase, expenses, other';
COMMENT ON COLUMN injury_activities.operator_name IS 'Nome del professionista che ha svolto l\'attività';
COMMENT ON COLUMN injury_activities.duration_minutes IS 'Durata in minuti (per fisioterapia)';
COMMENT ON COLUMN injury_activities.amount IS 'Importo per spese, rimborsi o acquisti';
COMMENT ON COLUMN injury_activities.currency IS 'Valuta (default EUR)';


