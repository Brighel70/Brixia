-- Verifica le presenze per la sessione specifica U18 del 14/10/2025
-- Session ID: b5cd5f3b-041b-4c64-86c2-bad8e51f0929

-- 1. Controlla tutte le presenze per questa sessione specifica
SELECT 
    a.session_id,
    a.player_id,
    a.status,
    a.injured_place,
    a.created_at,
    a.updated_at,
    p.given_name,
    p.family_name,
    s.session_date,
    s.location
FROM public.attendance a
LEFT JOIN public.people p ON a.player_id = p.id
LEFT JOIN public.sessions s ON a.session_id = s.id
WHERE a.session_id = 'b5cd5f3b-041b-4c64-86c2-bad8e51f0929'
ORDER BY p.family_name, p.given_name;

-- 2. Controlla se ci sono presenze per tutti i giocatori U18 in generale
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
JOIN public.people p ON a.player_id = p.id
JOIN public.sessions s ON a.session_id = s.id
WHERE p.player_categories::text LIKE '%d9c82f91-8087-47f5-9b90-9b729572f0e8%'  -- U18 category
  AND s.session_date >= '2025-10-01'  -- Sessioni recenti
ORDER BY s.session_date DESC, p.family_name;

-- 3. Conta quante presenze ci sono per ogni sessione U18
SELECT 
    s.id as session_id,
    s.session_date,
    s.location,
    COUNT(a.id) as attendance_count,
    COUNT(DISTINCT p.id) as total_players
FROM public.sessions s
LEFT JOIN public.attendance a ON s.id = a.session_id
LEFT JOIN public.people p ON p.player_categories::text LIKE '%d9c82f91-8087-47f5-9b90-9b729572f0e8%'
WHERE s.category_id = 'd9c82f91-8087-47f5-9b90-9b729572f0e8'
  AND s.session_date >= '2025-10-01'
GROUP BY s.id, s.session_date, s.location
ORDER BY s.session_date DESC;








