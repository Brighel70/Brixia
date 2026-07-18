-- Tabella per i tipi di evento assicurazione (menu "Tipo evento" nel modal Nuovo evento assicurazione)
-- I valori creati qui compaiono nel menu a tendina nella scheda persona > Infortuni > Nuovo evento assicurazione

CREATE TABLE IF NOT EXISTS insurance_event_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insurance_event_types_active_sort ON insurance_event_types(active, sort_order);

COMMENT ON TABLE insurance_event_types IS 'Tipi di evento per il modal Nuovo evento assicurazione (scheda persona > Infortuni)';

-- Inserisci i tipi attuali usati nell''app (stesso ordine del menu)
INSERT INTO insurance_event_types (name, sort_order) VALUES
  ('documentazione inviata allo Csen', 1),
  ('Documentazione integrativa inviata', 2),
  ('Richiesta rimborso', 3),
  ('Comunicazione con liquidatore', 4),
  ('Chiusura pratica', 5),
  ('Altro', 6)
ON CONFLICT (name) DO NOTHING;

-- RLS
ALTER TABLE insurance_event_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage insurance event types" ON insurance_event_types;
CREATE POLICY "Authenticated users can manage insurance event types" ON insurance_event_types
  FOR ALL USING (auth.role() = 'authenticated');
