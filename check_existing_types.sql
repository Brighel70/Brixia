-- ========================================
-- SCRIPT PER VERIFICARE I TIPI ESISTENTI
-- ========================================

-- 1. Verifica i tipi ENUM esistenti
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

-- 3. Verifica i valori attuali nella colonna status
SELECT DISTINCT status, COUNT(*) as count
FROM attendance 
GROUP BY status
ORDER BY status;

