-- Script per trovare l'ID persona mancante
-- ID: b6480b58-931b-4feb-8c88-e29fe4044953

-- 1. Controlla se l'ID esiste nella tabella people
SELECT 'people' as table_name, id, full_name, created_at 
FROM public.people 
WHERE id = 'b6480b58-931b-4feb-8c88-e29fe4044953';

-- 2. Controlla se l'ID esiste nella tabella people3
SELECT 'people3' as table_name, id, full_name, created_at 
FROM public.people3 
WHERE id = 'b6480b58-931b-4feb-8c88-e29fe4044953';

-- 3. Cerca ID simili (in caso di errori di digitazione)
SELECT 'people' as table_name, id, full_name, created_at 
FROM public.people 
WHERE id::text LIKE '%b6480b58%' OR id::text LIKE '%931b-4feb%' OR id::text LIKE '%8c88-e29fe4044953%';

-- 4. Mostra gli ultimi 10 record creati in people
SELECT 'Ultimi 10 record in people' as info, id, full_name, created_at 
FROM public.people 
ORDER BY created_at DESC 
LIMIT 10;

-- 5. Mostra gli ultimi 10 record creati in people3
SELECT 'Ultimi 10 record in people3' as info, id, full_name, created_at 
FROM public.people3 
ORDER BY created_at DESC 
LIMIT 10;
