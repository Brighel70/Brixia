-- Verifica gli orari degli eventi nel database
SELECT 
  id,
  title,
  event_date,
  event_time,
  start_time,
  end_time,
  event_type,
  created_at
FROM public.events
WHERE event_date >= CURRENT_DATE
ORDER BY event_date, start_time NULLS LAST;


