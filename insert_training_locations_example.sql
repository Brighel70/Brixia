-- Script per inserire dati di esempio nella tabella training_locations

-- Prima verifica le categorie disponibili
SELECT id, code, name FROM categories WHERE active = true ORDER BY sort;

-- Inserisci dati di esempio per alcune categorie
-- (Sostituire gli UUID con quelli reali delle tue categorie)

INSERT INTO training_locations (category_id, location, weekday, start_time, end_time) VALUES
-- Poderosa - Martedì a Brescia
((SELECT id FROM categories WHERE code = 'PODEROSA'), 'Brescia', 'Martedì', '19:30', '21:00'),

-- Poderosa - Giovedì a Brescia
((SELECT id FROM categories WHERE code = 'PODEROSA'), 'Brescia', 'Giovedì', '19:30', '21:00'),

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
((SELECT id FROM categories WHERE code = 'SERIE_B'), 'Gussago', 'Giovedì', '20:00', '21:30'),

-- Leonesse - Lunedì a Brescia
((SELECT id FROM categories WHERE code = 'LEONESSE'), 'Brescia', 'Lunedì', '19:00', '20:30'),

-- Leonesse - Mercoledì a Brescia
((SELECT id FROM categories WHERE code = 'LEONESSE'), 'Brescia', 'Mercoledì', '19:00', '20:30');

-- Verifica i dati inseriti
SELECT 
  c.name as categoria,
  tl.location,
  tl.weekday,
  tl.start_time,
  tl.end_time
FROM training_locations tl
JOIN categories c ON tl.category_id = c.id
ORDER BY c.sort, tl.weekday;


