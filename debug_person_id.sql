-- Script per debuggare il problema dell'ID persona
-- Verifichiamo se l'ID esiste e dove

-- 1. Controlla se l'ID esiste nella tabella people
SELECT 'people' as table_name, id, full_name, created_at 
FROM public.people 
WHERE id = 'b6480b58-931b-4feb-8c88-e29fe4044953';

-- 2. Controlla se l'ID esiste nella tabella people3
SELECT 'people3' as table_name, id, full_name, created_at 
FROM public.people3 
WHERE id = 'b6480b58-931b-4feb-8c88-e29fe4044953';

-- 3. Conta i record in entrambe le tabelle
SELECT 'people' as table_name, COUNT(*) as record_count FROM public.people
UNION ALL
SELECT 'people3' as table_name, COUNT(*) as record_count FROM public.people3;

-- 4. Mostra gli ultimi 5 record creati in people
SELECT 'Ultimi 5 record in people' as info, id, full_name, created_at 
FROM public.people 
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Mostra gli ultimi 5 record creati in people3
SELECT 'Ultimi 5 record in people3' as info, id, full_name, created_at 
FROM public.people3 
ORDER BY created_at DESC 
LIMIT 5;
