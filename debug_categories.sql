-- ========================================
-- DEBUG: VERIFICA PROBLEMA CATEGORIE
-- ========================================

-- Verifica se la tabella categories esiste
SELECT 'TABELLA CATEGORIES:' as info;
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'categories'
) as categories_table_exists;

-- Verifica le colonne della tabella categories
SELECT 'COLONNE CATEGORIES:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'categories' 
ORDER BY column_name;

-- Verifica i dati nella tabella categories
SELECT 'DATI CATEGORIES:' as info;
SELECT COUNT(*) as total_categories FROM categories;
SELECT id, name, code, sort, active FROM categories ORDER BY sort LIMIT 5;

-- Verifica se ci sono problemi di RLS
SELECT 'RLS POLICIES:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'categories';

-- Verifica se RLS è abilitato
SELECT 'RLS STATUS:' as info;
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'categories';

-- Test di accesso diretto
SELECT 'TEST ACCESSO:' as info;
SELECT COUNT(*) as accessible_categories FROM categories;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ DEBUG CATEGORIE COMPLETATO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Controlla i risultati sopra per identificare il problema';
  RAISE NOTICE '';
END $$;








