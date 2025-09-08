-- ========================================
-- TEST PULIZIA DATABASE - BRIXIA RUGBY
-- ========================================
-- Questo script testa che la pulizia del database sia andata a buon fine

-- 1. TEST STRUTTURA TABELLE
SELECT '=== TEST STRUTTURA TABELLE ===' as info;

-- Verifica che non ci siano tabelle duplicate
SELECT 
  'Test 1: Nessuna tabella duplicata' as test,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT table_name) THEN '✅ PASS'
    ELSE '❌ FAIL - Trovate tabelle duplicate'
  END as risultato
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verifica che tutte le tabelle principali esistano
SELECT 
  'Test 2: Tabelle principali esistenti' as test,
  CASE 
    WHEN COUNT(*) >= 10 THEN '✅ PASS'
    ELSE '❌ FAIL - Mancano tabelle principali'
  END as risultato
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'categories', 'players', 'profiles', 'user_roles', 'permissions',
    'role_permissions', 'sessions', 'attendance', 'player_categories',
    'staff_categories', 'roles'
  );

-- 2. TEST CAMPI OBBLIGATORI
SELECT '=== TEST CAMPI OBBLIGATORI ===' as info;

-- Verifica campo active in categories
SELECT 
  'Test 3: Campo active in categories' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'active' 
      AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Campo active mancante'
  END as risultato;

-- Verifica campo sort in categories
SELECT 
  'Test 4: Campo sort in categories' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'sort' 
      AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Campo sort mancante'
  END as risultato;

-- Verifica campo user_role_id in profiles
SELECT 
  'Test 5: Campo user_role_id in profiles' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      AND column_name = 'user_role_id' 
      AND table_schema = 'public'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Campo user_role_id mancante'
  END as risultato;

-- 3. TEST FOREIGN KEY
SELECT '=== TEST FOREIGN KEY ===' as info;

-- Verifica che non ci siano foreign key rotte
SELECT 
  'Test 6: Nessuna foreign key rotta' as test,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Trovate foreign key rotte'
  END as risultato
FROM (
  SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = ccu.table_name 
      AND table_schema = 'public'
    )
) as broken_fks;

-- 4. TEST DATI ORFANI
SELECT '=== TEST DATI ORFANI ===' as info;

-- Verifica che non ci siano dati orfani
SELECT 
  'Test 7: Nessun dato orfano in player_categories' as test,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Trovati dati orfani'
  END as risultato
FROM player_categories pc
LEFT JOIN players p ON pc.player_id = p.id
LEFT JOIN categories c ON pc.category_id = c.id
WHERE p.id IS NULL OR c.id IS NULL;

SELECT 
  'Test 8: Nessun dato orfano in staff_categories' as test,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Trovati dati orfani'
  END as risultato
FROM staff_categories sc
LEFT JOIN profiles pr ON sc.user_id = pr.id
LEFT JOIN categories c ON sc.category_id = c.id
WHERE pr.id IS NULL OR c.id IS NULL;

SELECT 
  'Test 9: Nessun dato orfano in role_permissions' as test,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Trovati dati orfani'
  END as risultato
FROM role_permissions rp
LEFT JOIN user_roles ur ON rp.role_id = ur.id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE ur.id IS NULL OR p.id IS NULL;

-- 5. TEST ENUM
SELECT '=== TEST ENUM ===' as info;

-- Verifica che role_enum abbia tutti i valori necessari
SELECT 
  'Test 10: role_enum completo' as test,
  CASE 
    WHEN COUNT(*) >= 13 THEN '✅ PASS'
    ELSE '❌ FAIL - role_enum incompleto'
  END as risultato
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'role_enum';

-- 6. TEST INDICI
SELECT '=== TEST INDICI ===' as info;

-- Verifica che non ci siano indici duplicati
SELECT 
  'Test 11: Nessun indice duplicato' as test,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT indexname) THEN '✅ PASS'
    ELSE '❌ FAIL - Trovati indici duplicati'
  END as risultato
FROM pg_indexes 
WHERE schemaname = 'public';

-- 7. TEST POLITICHE RLS
SELECT '=== TEST POLITICHE RLS ===' as info;

-- Verifica che non ci siano politiche RLS duplicate
SELECT 
  'Test 12: Nessuna politica RLS duplicata' as test,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT policyname) THEN '✅ PASS'
    ELSE '❌ FAIL - Trovate politiche RLS duplicate'
  END as risultato
FROM pg_policies 
WHERE schemaname = 'public';

-- 8. TEST PERFORMANCE
SELECT '=== TEST PERFORMANCE ===' as info;

-- Verifica che le query principali funzionino
SELECT 
  'Test 13: Query categorie funziona' as test,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Query categorie non funziona'
  END as risultato
FROM categories;

SELECT 
  'Test 14: Query giocatori funziona' as test,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Query giocatori non funziona'
  END as risultato
FROM players;

SELECT 
  'Test 15: Query profili funziona' as test,
  CASE 
    WHEN COUNT(*) >= 0 THEN '✅ PASS'
    ELSE '❌ FAIL - Query profili non funziona'
  END as risultato
FROM profiles;

-- 9. RIEPILOGO FINALE
SELECT '=== RIEPILOGO FINALE ===' as info;

-- Conta i test passati
WITH test_results AS (
  SELECT 'Test 1' as test_name, 
    CASE WHEN COUNT(*) = COUNT(DISTINCT table_name) THEN 1 ELSE 0 END as passed
  FROM information_schema.tables WHERE table_schema = 'public'
  UNION ALL
  SELECT 'Test 2' as test_name, 
    CASE WHEN COUNT(*) >= 10 THEN 1 ELSE 0 END as passed
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('categories', 'players', 'profiles', 'user_roles', 'permissions',
                       'role_permissions', 'sessions', 'attendance', 'player_categories',
                       'staff_categories', 'roles')
  UNION ALL
  SELECT 'Test 3' as test_name, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'active' AND table_schema = 'public') THEN 1 ELSE 0 END as passed
  UNION ALL
  SELECT 'Test 4' as test_name, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'sort' AND table_schema = 'public') THEN 1 ELSE 0 END as passed
  UNION ALL
  SELECT 'Test 5' as test_name, 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'user_role_id' AND table_schema = 'public') THEN 1 ELSE 0 END as passed
)
SELECT 
  'Risultato finale:' as info,
  COUNT(*) as test_totali,
  SUM(passed) as test_passed,
  ROUND(SUM(passed) * 100.0 / COUNT(*), 2) as percentuale_successo,
  CASE 
    WHEN SUM(passed) = COUNT(*) THEN '✅ TUTTI I TEST PASSATI'
    WHEN SUM(passed) >= COUNT(*) * 0.8 THEN '⚠️ MAGGIOR PARTE DEI TEST PASSATI'
    ELSE '❌ MOLTI TEST FALLITI'
  END as stato_finale
FROM test_results;

SELECT '=== TEST COMPLETATI ===' as info;

