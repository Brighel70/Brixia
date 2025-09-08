-- Script per correggere la foreign key della tabella injuries
-- Il constraint sta ancora puntando a people3 invece di people

-- 1. Prima verifichiamo lo stato attuale del constraint
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
    AND tc.table_name = 'injuries'
    AND kcu.column_name = 'person_id';

-- 2. Rimuoviamo il constraint esistente (se punta a people3)
ALTER TABLE public.injuries DROP CONSTRAINT IF EXISTS injuries_person_id_fkey;

-- 3. Creiamo il constraint corretto che punta a people
ALTER TABLE public.injuries 
ADD CONSTRAINT injuries_person_id_fkey 
FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;

-- 4. Verifichiamo che il constraint sia stato creato correttamente
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
    AND tc.table_name = 'injuries'
    AND kcu.column_name = 'person_id';

-- 5. Testiamo che la tabella people abbia dati
SELECT COUNT(*) as people_count FROM public.people;
SELECT COUNT(*) as people3_count FROM public.people3;

-- 6. Verifichiamo che ci siano ID validi nella tabella people
SELECT id, full_name FROM public.people LIMIT 5;
