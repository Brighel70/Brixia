-- Aggiungi la colonna weekday alla tabella training_locations
ALTER TABLE public.training_locations 
ADD COLUMN IF NOT EXISTS weekday VARCHAR(20) CHECK (weekday IN ('Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'));

-- Aggiungi un indice per performance
CREATE INDEX IF NOT EXISTS idx_training_locations_weekday ON training_locations(weekday);

-- Verifica la struttura aggiornata
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'training_locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;




