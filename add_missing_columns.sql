-- Aggiungi le colonne mancanti alla tabella training_locations
ALTER TABLE public.training_locations 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS location VARCHAR(50) CHECK (location IN ('Brescia', 'Ospitaletto', 'Gussago')),
ADD COLUMN IF NOT EXISTS start_time TIME;

-- Aggiungi indici per performance
CREATE INDEX IF NOT EXISTS idx_training_locations_category_id ON training_locations(category_id);
CREATE INDEX IF NOT EXISTS idx_training_locations_location ON training_locations(location);

-- Verifica la struttura aggiornata
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'training_locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;