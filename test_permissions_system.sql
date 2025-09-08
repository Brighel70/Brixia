-- ========================================
-- TEST SISTEMA PERMESSI - BRIXIA RUGBY
-- ========================================
-- Questo script testa il sistema di permessi riabilitato

-- 1. Verifica che tutti i ruoli abbiano permessi
SELECT 
  'Test 1: Ruoli con permessi' as test,
  ur.name as ruolo,
  COUNT(rp.permission_id) as numero_permessi
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
GROUP BY ur.name, ur.position_order
ORDER BY ur.position_order;

-- 2. Verifica che tutti i permessi siano assegnati
SELECT 
  'Test 2: Permessi assegnati' as test,
  p.category as categoria,
  COUNT(rp.role_id) as ruoli_che_hanno_permesso
FROM permissions p
LEFT JOIN role_permissions rp ON p.id = rp.permission_id
GROUP BY p.category, p.position_order
ORDER BY p.category, p.position_order;

-- 3. Test specifico per Admin (deve avere tutti i permessi)
SELECT 
  'Test 3: Admin ha tutti i permessi' as test,
  COUNT(p.id) as permessi_totali,
  COUNT(rp.permission_id) as permessi_admin,
  CASE 
    WHEN COUNT(p.id) = COUNT(rp.permission_id) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as risultato
FROM permissions p
CROSS JOIN user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id AND p.id = rp.permission_id
WHERE ur.name = 'Admin';

-- 4. Test specifico per Player (deve avere permessi limitati)
SELECT 
  'Test 4: Player ha permessi limitati' as test,
  ur.name as ruolo,
  p.category as categoria,
  COUNT(rp.permission_id) as permessi
FROM user_roles ur
LEFT JOIN role_permissions rp ON ur.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE ur.name = 'Player'
GROUP BY ur.name, p.category
ORDER BY p.category;

-- 5. Verifica che non ci siano permessi duplicati
SELECT 
  'Test 5: Nessun permesso duplicato' as test,
  role_id,
  permission_id,
  COUNT(*) as occorrenze
FROM role_permissions
GROUP BY role_id, permission_id
HAVING COUNT(*) > 1;

-- 6. Verifica che tutti i profili abbiano un ruolo assegnato
SELECT 
  'Test 6: Profili con ruoli' as test,
  COUNT(*) as profili_totali,
  COUNT(user_role_id) as profili_con_ruolo,
  COUNT(*) - COUNT(user_role_id) as profili_senza_ruolo
FROM profiles;

-- 7. Mostra i profili senza ruolo (se ce ne sono)
SELECT 
  'Test 7: Profili senza ruolo' as test,
  id,
  full_name,
  email,
  role
FROM profiles
WHERE user_role_id IS NULL;

-- 8. Test finale: verifica che il sistema sia pronto
SELECT 
  'Test 8: Sistema pronto' as test,
  CASE 
    WHEN (SELECT COUNT(*) FROM user_roles) >= 13 
     AND (SELECT COUNT(*) FROM permissions) >= 20
     AND (SELECT COUNT(*) FROM role_permissions) >= 50
     AND (SELECT COUNT(*) FROM profiles WHERE user_role_id IS NOT NULL) > 0
    THEN '✅ SISTEMA PRONTO'
    ELSE '❌ SISTEMA NON PRONTO'
  END as risultato;

-- 9. Mostra un riepilogo completo
SELECT 
  'RIEPILOGO FINALE' as info,
  'Ruoli creati' as tipo,
  COUNT(*)::text as valore
FROM user_roles
UNION ALL
SELECT 
  'RIEPILOGO FINALE' as info,
  'Permessi creati' as tipo,
  COUNT(*)::text as valore
FROM permissions
UNION ALL
SELECT 
  'RIEPILOGO FINALE' as info,
  'Associazioni ruoli-permessi' as tipo,
  COUNT(*)::text as valore
FROM role_permissions
UNION ALL
SELECT 
  'RIEPILOGO FINALE' as info,
  'Profili con ruolo' as tipo,
  COUNT(*)::text as valore
FROM profiles
WHERE user_role_id IS NOT NULL;


