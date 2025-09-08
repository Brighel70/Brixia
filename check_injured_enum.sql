-- ========================================
-- SCRIPT PER VERIFICARE L'ENUM injured_enum ESISTENTE
-- ========================================

-- 1. Verifica i valori dell'enum injured_enum
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname = 'injured_enum'
ORDER BY e.enumsortorder;

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

-- 3. Verifica i valori attuali nella colonna injured_place
SELECT DISTINCT injured_place, COUNT(*) as count
FROM attendance 
WHERE injured_place IS NOT NULL
GROUP BY injured_place
ORDER BY injured_place;


