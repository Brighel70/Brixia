-- Script semplice per aggiungere la colonna paid_at

ALTER TABLE fee_assignments 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fee_assignments' 
AND column_name = 'paid_at';












