-- VERIFICA STRUTTURA REALE TABELLA INJURIES

-- 1. Mostra TUTTE le colonne della tabella injuries
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'injuries' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Mostra alcuni record di esempio per vedere i campi reali
SELECT * FROM injuries LIMIT 3;

-- 3. Trova Federico Viola nella tabella people
SELECT 
    id, 
    full_name, 
    given_name, 
    family_name
FROM people 
WHERE full_name ILIKE '%federico%viola%' 
   OR given_name ILIKE '%federico%' 
   OR family_name ILIKE '%viola%';

-- 4. Verifica se ha infortuni (senza specificare campi)
SELECT 
    i.*,
    p.full_name
FROM injuries i
JOIN people p ON p.id = i.person_id
WHERE p.full_name ILIKE '%federico%viola%' 
   OR p.given_name ILIKE '%federico%' 
   OR p.family_name ILIKE '%viola%';



