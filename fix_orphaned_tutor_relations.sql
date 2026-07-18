-- Fix per relazioni tutor orfane
-- Prima pulisci i dati orfani, poi ricrea le relazioni corrette

-- 1. Mostra le relazioni orfane (tutor_id che non esistono in people)
SELECT 
    'Relazioni orfane trovate:' as info,
    tar.id,
    tar.tutor_id,
    tar.athlete_id,
    tar.relationship
FROM public.tutor_athlete_relations tar
LEFT JOIN public.people p ON tar.tutor_id = p.id
WHERE p.id IS NULL;

-- 2. Mostra i tutor esistenti nella tabella tutors che potrebbero essere migrati
SELECT 
    'Tutor esistenti in tutors:' as info,
    t.id,
    t.full_name,
    t.email
FROM public.tutors t
LIMIT 5;

-- 3. Pulisci le relazioni orfane
DELETE FROM public.tutor_athlete_relations 
WHERE tutor_id NOT IN (SELECT id FROM public.people);

-- 4. Verifica che non ci siano più relazioni orfane
SELECT 
    'Relazioni rimanenti dopo pulizia:' as info,
    COUNT(*) as count
FROM public.tutor_athlete_relations;

-- 5. Mostra le relazioni valide rimanenti
SELECT 
    'Relazioni valide:' as info,
    tar.id,
    tar.tutor_id,
    p.full_name as tutor_name,
    tar.athlete_id,
    tar.relationship
FROM public.tutor_athlete_relations tar
JOIN public.people p ON tar.tutor_id = p.id
LIMIT 5;


