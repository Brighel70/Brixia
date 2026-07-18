-- Aggiungi configurazione allenamenti per U18
-- U18 si allena Martedì, Giovedì e Venerdì

INSERT INTO training_locations (category_id, location, weekday, start_time, end_time) VALUES
-- U18 - Martedì a Ospitaletto
((SELECT id FROM categories WHERE code = 'U18'), 'Ospitaletto', 'Martedì', '18:30', '20:00'),

-- U18 - Giovedì a Ospitaletto  
((SELECT id FROM categories WHERE code = 'U18'), 'Ospitaletto', 'Giovedì', '18:30', '20:00'),

-- U18 - Venerdì a Ospitaletto
((SELECT id FROM categories WHERE code = 'U18'), 'Ospitaletto', 'Venerdì', '18:30', '20:00');

-- Verifica la configurazione inserita
SELECT 
  c.code as categoria,
  c.name as nome,
  tl.location,
  tl.weekday,
  tl.start_time,
  tl.end_time
FROM categories c
JOIN training_locations tl ON c.id = tl.category_id
WHERE c.code = 'U18'
ORDER BY tl.weekday;




