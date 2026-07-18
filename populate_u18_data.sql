-- Popola i dati mancanti per U18
-- Prima verifica i dati attuali
SELECT * FROM training_locations ORDER BY created_at;

-- Aggiorna i record esistenti con i dati mancanti
-- (Sostituisci gli UUID con quelli reali)

-- Per U18 - Martedì
UPDATE training_locations 
SET 
  category_id = (SELECT id FROM categories WHERE code = 'U18'),
  location = 'Ospitaletto',
  start_time = '18:30:00',
  end_time = '20:00:00'
WHERE weekday = 'Martedì' 
AND category_id IS NULL;

-- Per U18 - Giovedì  
UPDATE training_locations 
SET 
  category_id = (SELECT id FROM categories WHERE code = 'U18'),
  location = 'Ospitaletto', 
  start_time = '18:30:00',
  end_time = '20:00:00'
WHERE weekday = 'Giovedì' 
AND category_id IS NULL;

-- Per U18 - Venerdì
UPDATE training_locations 
SET 
  category_id = (SELECT id FROM categories WHERE code = 'U18'),
  location = 'Ospitaletto',
  start_time = '18:30:00', 
  end_time = '20:00:00'
WHERE weekday = 'Venerdì' 
AND category_id IS NULL;

-- Se non ci sono record per U18, inseriscili
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

-- Verifica il risultato finale
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




