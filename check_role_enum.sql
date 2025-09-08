-- =====================================================
-- SCRIPT: Verifica valori enum role_enum
-- =====================================================

-- Controlla i valori dell'enum role_enum
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'role_enum'
ORDER BY e.enumsortorder;

-- Controlla anche la struttura della tabella profiles
SELECT 
  column_name, 
  data_type, 
  udt_name
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'role';

-- Controlla i valori attuali nella tabella profiles
SELECT DISTINCT role, COUNT(*) as count
FROM public.profiles 
GROUP BY role
ORDER BY role;






