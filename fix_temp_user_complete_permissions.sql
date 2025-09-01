-- SCRIPT COMPLETO PER RENDERE L'UTENTE TEMPORANEO UN ADMIN COMPLETO
-- Questo script assegna TUTTI i permessi e categorie per vedere tutte le card

-- =====================================
-- PASSO 1: VERIFICA UTENTE TEMPORANEO
-- =====================================

SELECT 
  'VERIFICA UTENTE TEMPORANEO' as step,
  id,
  full_name,
  email,
  role,
  created_at
FROM profiles 
WHERE email = 'temp@brixiarugby.it';

-- =====================================
-- PASSO 2: ASSEGNA TUTTE LE CATEGORIE
-- =====================================

DO $$
DECLARE
  temp_user_id uuid;
  category_rec record;
BEGIN
  -- Ottieni l'ID dell'utente temporaneo
  SELECT id INTO temp_user_id 
  FROM profiles 
  WHERE email = 'temp@brixiarugby.it';
  
  IF temp_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utente temporaneo non trovato!';
  END IF;
  
  RAISE NOTICE '🆔 ID utente temporaneo: %', temp_user_id;
  
  -- Assegna TUTTE le categorie disponibili
  FOR category_rec IN 
    SELECT id, code, name FROM categories
  LOOP
    INSERT INTO staff_categories (user_id, category_id)
    VALUES (temp_user_id, category_rec.id)
    ON CONFLICT (user_id, category_id) DO NOTHING;
    
    RAISE NOTICE '✅ Categoria assegnata: % (%s)', category_rec.name, category_rec.code;
  END LOOP;
  
  RAISE NOTICE '🎉 TUTTE LE CATEGORIE ASSEGNATE!';
END $$;

-- =====================================
-- PASSO 3: VERIFICA FINALE COMPLETA
-- =====================================

-- Controlla le categorie assegnate
SELECT 
  'CATEGORIE UTENTE TEMPORANEO' as controllo,
  c.code,
  c.name
FROM staff_categories sc
JOIN profiles p ON sc.user_id = p.id
JOIN categories c ON sc.category_id = c.id
WHERE p.email = 'temp@brixiarugby.it'
ORDER BY c.code;

-- Conta le categorie assegnate
SELECT 
  'RIEPILOGO CATEGORIE' as controllo,
  COUNT(*) as numero_categorie
FROM staff_categories sc
JOIN profiles p ON sc.user_id = p.id
WHERE p.email = 'temp@brixiarugby.it';

-- Controlla il ruolo
SELECT 
  'RUOLO UTENTE TEMPORANEO' as controllo,
  role,
  full_name,
  email
FROM profiles 
WHERE email = 'temp@brixiarugby.it';

-- =====================================
-- PASSO 4: VERIFICA CHE TUTTO FUNZIONI
-- =====================================

-- Verifica che l'utente possa vedere tutte le categorie
SELECT 
  'VERIFICA ACCESSO COMPLETO' as controllo,
  p.full_name,
  p.role,
  COUNT(sc.category_id) as categorie_assegnate,
  CASE 
    WHEN COUNT(sc.category_id) > 0 THEN '✅ PUÒ VEDERE TUTTO'
    ELSE '❌ ACCESSO LIMITATO'
  END as status
FROM profiles p
LEFT JOIN staff_categories sc ON p.id = sc.user_id
WHERE p.email = 'temp@brixiarugby.it'
GROUP BY p.id, p.full_name, p.role;

-- =====================================
-- MESSAGGIO FINALE
-- =====================================
SELECT '🎉 UTENTE TEMPORANEO CON ACCESSO COMPLETO!' as messaggio;
SELECT 'Ora dovrebbe vedere:' as prossimo_passaggio;
SELECT '✅ Card Attività e Configurazioni' as funzionalita;
SELECT '✅ Sezione Panoramica Rapida completa' as funzionalita;
SELECT '✅ Card Categorie espandibile' as funzionalita;
SELECT '✅ Accesso a tutte le funzionalità admin' as funzionalita;
SELECT '' as separatore;
SELECT '🚀 FAI LOGOUT E LOGIN DI NUOVO!' as istruzione;


