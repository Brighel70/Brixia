-- Tipi di attività infortunio: opzioni del menu "Tipo di Attività" nel modal Aggiungi Attività (scheda persona > Infortuni).
-- L'ordine (sort_order) impostato qui viene rispettato nel popup.

CREATE TABLE IF NOT EXISTS injury_activity_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injury_activity_types_active_sort ON injury_activity_types(active, sort_order);

COMMENT ON TABLE injury_activity_types IS 'Tipi di attività nel modal Aggiungi Attività (Infortuni). Ordinabili con drag & drop in Impostazioni > Infortuni/Assicurazione.';

-- Inserisci i tipi predefiniti (stesso ordine e codice usati in injury_activities.activity_type)
INSERT INTO injury_activity_types (name, code, sort_order) VALUES
  ('Visita Medica', 'medical_visit', 1),
  ('Fisioterapia', 'physiotherapy', 2),
  ('Test/Esame', 'test', 3),
  ('Annotazione', 'note', 4),
  ('Rimborso Assicurativo', 'insurance_refund', 5),
  ('Acquisto Attrezzatura', 'equipment_purchase', 6),
  ('Spese Sostenute', 'expenses', 7),
  ('Altro', 'other', 8)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE injury_activity_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage injury activity types" ON injury_activity_types;
CREATE POLICY "Authenticated users can manage injury activity types" ON injury_activity_types
  FOR ALL USING (auth.role() = 'authenticated');
