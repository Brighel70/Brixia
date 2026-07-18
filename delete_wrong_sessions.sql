-- Elimina le sessioni sbagliate per U18
-- Elimina Lunedì e Mercoledì che non sono configurati per U18

DELETE FROM sessions 
WHERE category_id = (SELECT id FROM categories WHERE code = 'U18')
AND session_date IN ('2025-10-20', '2025-10-22');

-- Verifica le sessioni rimanenti per U18
SELECT 
  s.session_date,
  s.location,
  s.start_time,
  s.end_time
FROM sessions s
JOIN categories c ON s.category_id = c.id
WHERE c.code = 'U18'
ORDER BY s.session_date;




