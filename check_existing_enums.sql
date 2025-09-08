-- ========================================
-- SCRIPT PER VERIFICARE TUTTI GLI ENUM ESISTENTI
-- ========================================

-- 1. Verifica tutti i tipi ENUM esistenti
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typtype = 'e'
ORDER BY t.typname, e.enumsortorder;

-- 2. Verifica la struttura della tabella attendance
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'attendance' 
ORDER BY ordinal_position;

-- 3. Verifica la struttura della tabella sessions
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;

-- 4. Verifica la struttura della tabella profiles
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

