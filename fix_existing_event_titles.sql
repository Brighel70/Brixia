-- Script per correggere i titoli degli eventi esistenti
-- Esegui questo script nel tuo database Supabase

-- Aggiorna i titoli degli eventi esistenti basandosi su is_home
UPDATE public.events 
SET title = CASE 
  WHEN is_home = true THEN 
    'Partita ' || 
    (SELECT name FROM categories WHERE id = events.category_id) || 
    ' vs ' || 
    COALESCE(opponent, '')
  WHEN is_home = false THEN 
    'Partita ' || 
    COALESCE(opponent, '') || 
    ' vs ' || 
    (SELECT name FROM categories WHERE id = events.category_id)
  ELSE title
END
WHERE event_type = 'partita' 
  AND category_id IS NOT NULL 
  AND opponent IS NOT NULL 
  AND opponent != '';

-- Verifica le modifiche
SELECT 
  id,
  title,
  event_type,
  is_home,
  opponent,
  (SELECT name FROM categories WHERE id = events.category_id) as category_name
FROM public.events 
WHERE event_type = 'partita'
ORDER BY created_at DESC;

