-- Verifica se U18 ha già la configurazione
SELECT 
  c.code as categoria,
  c.name as nome,
  tl.location,
  tl.weekday,
  tl.start_time,
  tl.end_time
FROM training_locations tl
JOIN categories c ON tl.category_id = c.id
WHERE c.code = 'U18'
ORDER BY tl.weekday;

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




