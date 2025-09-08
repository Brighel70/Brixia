-- Script per verificare le tabelle esistenti nel database
-- Esegui questo script nel tuo database Supabase

-- 1. Verifica se esiste la tabella people
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'people' 
  AND table_schema = 'public';

-- 2. Verifica se esiste la tabella user_roles
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'user_roles' 
  AND table_schema = 'public';

-- 3. Verifica se esiste la tabella person_staff_roles
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'person_staff_roles' 
  AND table_schema = 'public';

-- 4. Verifica se esiste una tabella simile per collegare persone ai ruoli
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name LIKE '%person%role%' 
  OR table_name LIKE '%people%role%'
  OR table_name LIKE '%staff%role%'
  AND table_schema = 'public';

-- 5. Verifica la struttura della tabella people
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'people'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Verifica la struttura della tabella user_roles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles'
  AND table_schema = 'public'
ORDER BY ordinal_position;


