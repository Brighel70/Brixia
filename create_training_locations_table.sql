-- Creazione tabella training_locations per le sedi di allenamento delle categorie
CREATE TABLE IF NOT EXISTS training_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  location VARCHAR(50) NOT NULL CHECK (location IN ('Brescia', 'Ospitaletto', 'Gussago')),
  weekday VARCHAR(20) NOT NULL CHECK (weekday IN ('Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_training_locations_category_id ON training_locations(category_id);
CREATE INDEX IF NOT EXISTS idx_training_locations_location ON training_locations(location);
CREATE INDEX IF NOT EXISTS idx_training_locations_weekday ON training_locations(weekday);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_training_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_training_locations_updated_at
  BEFORE UPDATE ON training_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_training_locations_updated_at();

-- RLS (Row Level Security) - se necessario
ALTER TABLE training_locations ENABLE ROW LEVEL SECURITY;

-- Policy per permettere a tutti gli utenti autenticati di leggere
CREATE POLICY "Allow authenticated users to read training_locations" ON training_locations
  FOR SELECT TO authenticated
  USING (true);

-- Policy per permettere agli admin di inserire/modificare/eliminare
CREATE POLICY "Allow admins to manage training_locations" ON training_locations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Commenti per documentazione
COMMENT ON TABLE training_locations IS 'Sedi di allenamento per ogni categoria';
COMMENT ON COLUMN training_locations.category_id IS 'ID della categoria di riferimento';
COMMENT ON COLUMN training_locations.location IS 'Sede di allenamento (Brescia, Ospitaletto, Gussago)';
COMMENT ON COLUMN training_locations.weekday IS 'Giorno della settimana (Lunedì, Martedì, etc.)';
COMMENT ON COLUMN training_locations.start_time IS 'Orario di inizio allenamento';
COMMENT ON COLUMN training_locations.end_time IS 'Orario di fine allenamento';
