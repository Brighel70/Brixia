-- Verifica i dettagli delle presenze per la sessione del 14/10/2025
-- Session ID: b5cd5f3b-041b-4c64-86c2-bad8e51f0929

-- 1. Controlla TUTTE le presenze per questa sessione
SELECT 
    a.id as attendance_id,
    a.session_id,
    a.player_id,
    a.status,
    a.injured_place,
    a.created_at,
    a.updated_at,
    p.given_name,
    p.family_name,
    p.player_categories
FROM public.attendance a
LEFT JOIN public.people p ON a.player_id = p.id
WHERE a.session_id = 'b5cd5f3b-041b-4c64-86c2-bad8e51f0929'
ORDER BY a.created_at DESC;

-- 2. Controlla se ci sono presenze duplicate
SELECT 
    player_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(status, ', ') as statuses,
    STRING_AGG(id::text, ', ') as attendance_ids
FROM public.attendance 
WHERE session_id = 'b5cd5f3b-041b-4c64-86c2-bad8e51f0929'
GROUP BY player_id
HAVING COUNT(*) > 1;

-- 3. Verifica la struttura della tabella attendance
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'attendance' 
  AND table_schema = 'public'
ORDER BY ordinal_position;








