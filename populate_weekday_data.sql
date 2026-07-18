-- Popola i dati esistenti con i giorni della settimana
-- Prima verifica i dati attuali
SELECT * FROM training_locations ORDER BY created_at;

-- Aggiorna i dati esistenti con i giorni della settimana
-- (Sostituisci gli UUID con quelli reali delle tue categorie)

-- U18 - Martedì, Giovedì, Venerdì a Ospitaletto
UPDATE training_locations 
SET weekday = 'Martedì' 
WHERE category_id = (SELECT id FROM categories WHERE code = 'U18') 
AND location = 'Ospitaletto' 
AND start_time = '18:30:00';

UPDATE training_locations 
SET weekday = 'Giovedì' 
WHERE category_id = (SELECT id FROM categories WHERE code = 'U18') 
AND location = 'Ospitaletto' 
AND start_time = '18:30:00'
AND weekday IS NULL;

UPDATE training_locations 
SET weekday = 'Venerdì' 
WHERE category_id = (SELECT id FROM categories WHERE code = 'U18') 
AND location = 'Ospitaletto' 
AND start_time = '18:30:00'
AND weekday IS NULL;

-- Se non ci sono dati per U18, inseriscili
INSERT INTO training_locations (category_id, location, weekday, start_time, end_time) 
SELECT 
  (SELECT id FROM categories WHERE code = 'U18'),
  'Ospitaletto',
  weekday,
  '18:30:00',
  '20:00:00'
FROM (VALUES ('Martedì'), ('Giovedì'), ('Venerdì')) AS t(weekday)
WHERE NOT EXISTS (
  SELECT 1 FROM training_locations tl
  JOIN categories c ON tl.category_id = c.id
  WHERE c.code = 'U18'
);

-- Verifica il risultato
SELECT 
  c.code as categoria,
  tl.location,
  tl.weekday,
  tl.start_time,
  tl.end_time
FROM training_locations tl
JOIN categories c ON tl.category_id = c.id
WHERE c.code = 'U18'
ORDER BY tl.weekday;




