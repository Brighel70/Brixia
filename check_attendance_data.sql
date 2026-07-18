-- Verifica le presenze salvate nel database
-- Sostituisci 'SESSION_ID_U18' con l'ID della sessione U18 che stai visualizzando

-- 1. Controlla tutte le presenze per la sessione U18
SELECT 
    a.session_id,
    a.player_id,
    a.status,
    a.created_at,
    p.given_name,
    p.family_name,
    s.session_date,
    s.location
FROM public.attendance a
LEFT JOIN public.people p ON a.player_id = p.id
LEFT JOIN public.sessions s ON a.session_id = s.id
WHERE s.session_date = '2025-10-14'  -- Data della sessione U18
  AND s.location = 'Brescia'
ORDER BY p.family_name, p.given_name;

-- 2. Controlla se ci sono presenze per i giocatori U18
SELECT 
    a.*,
    p.given_name,
    p.family_name
FROM public.attendance a
JOIN public.people p ON a.player_id = p.id
WHERE p.player_categories::text LIKE '%d9c82f91-8087-47f5-9b90-9b729572f0e8%'  -- ID categoria U18
ORDER BY a.created_at DESC
LIMIT 10;

-- 3. Controlla le sessioni U18
SELECT 
    s.id,
    s.session_date,
    s.location,
    s.category_id,
    c.name as category_name
FROM public.sessions s
JOIN public.categories c ON s.category_id = c.id
WHERE c.id = 'd9c82f91-8087-47f5-9b90-9b729572f0e8'  -- ID categoria U18
ORDER BY s.session_date DESC;








