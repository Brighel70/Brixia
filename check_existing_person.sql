-- Script per verificare se l'ID persona esiste nel database
-- ID dall'URL: d22e30e5-780a-4ecc-98c4-701f0ca92fe6

-- 1. Controlla se l'ID esiste nella tabella people
SELECT 'people' as table_name, id, full_name, created_at 
FROM public.people 
WHERE id = 'd22e30e5-780a-4ecc-98c4-701f0ca92fe6';

-- 2. Controlla se l'ID esiste nella tabella people3
SELECT 'people3' as table_name, id, full_name, created_at 
FROM public.people3 
WHERE id = 'd22e30e5-780a-4ecc-98c4-701f0ca92fe6';

-- 3. Mostra tutti i constraint della tabella injuries
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'injuries';
