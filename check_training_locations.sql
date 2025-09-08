-- Script per verificare e popolare la tabella training_locations

-- 1. Verifica se la tabella esiste e ha dati
SELECT 'Verifica tabella training_locations' as info;
SELECT COUNT(*) as total_records FROM training_locations;

-- 2. Mostra la struttura della tabella
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'training_locations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Mostra i dati esistenti (se ce ne sono)
SELECT * FROM training_locations LIMIT 10;

-- 4. Verifica le categorie disponibili
SELECT id, code, name FROM categories WHERE active = true ORDER BY sort;

-- 5. Se non ci sono dati, inserisci alcuni esempi
-- (Decommentare le righe seguenti se necessario)

/*
-- Esempio di inserimento dati per alcune categorie
-- Sostituire gli UUID con quelli reali delle tue categorie

INSERT INTO training_locations (category_id, location, weekday, start_time, end_time) VALUES
-- Under 16 - Lunedì a Gussago
((SELECT id FROM categories WHERE code = 'U16'), 'Gussago', 'Lunedì', '19:00', '20:30'),

-- Under 16 - Mercoledì a Gussago  
((SELECT id FROM categories WHERE code = 'U16'), 'Gussago', 'Mercoledì', '19:00', '20:30'),

-- Brixia Old - Martedì a Ospitaletto
((SELECT id FROM categories WHERE code = 'BRIXIAOLD'), 'Ospitaletto', 'Martedì', '20:00', '21:00'),

-- Brixia Old - Giovedì a Ospitaletto
((SELECT id FROM categories WHERE code = 'BRIXIAOLD'), 'Ospitaletto', 'Giovedì', '20:00', '21:00'),

-- Serie B - Martedì a Gussago
((SELECT id FROM categories WHERE code = 'SERIE_B'), 'Gussago', 'Martedì', '20:00', '21:30'),

-- Serie B - Giovedì a Gussago
((SELECT id FROM categories WHERE code = 'SERIE_B'), 'Gussago', 'Giovedì', '20:00', '21:30');
*/








