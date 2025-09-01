-- SCRIPT PER DARE TUTTI I PERMESSI ALL'UTENTE TEMPORANEO
-- Questo script rende l'utente temporaneo un admin completo

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
-- PASSO 2: ASSEGNA TUTTI I PERMESSI ADMIN
-- =====================================

DO $$
DECLARE
  temp_user_id uuid;
  permission_rec record;
BEGIN
  -- Ottieni l'ID dell'utente temporaneo
  SELECT id INTO temp_user_id 
  FROM profiles 
  WHERE email = 'temp@brixiarugby.it';
  
  IF temp_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utente temporaneo non trovato!';
  END IF;
  
  RAISE NOTICE '🆔 ID utente temporaneo: %', temp_user_id;
  
  -- Assegna TUTTI i permessi disponibili
  FOR permission_rec IN 
    SELECT id FROM permissions
  LOOP
    -- Inserisci permesso utente (se non esiste già)
    INSERT INTO user_permissions (user_id, permission_id)
    VALUES (temp_user_id, permission_rec.id)
    ON CONFLICT (user_id, permission_id) DO NOTHING;
    
    RAISE NOTICE '✅ Permesso assegnato: %', permission_rec.id;
  END LOOP;
  
  -- Assegna TUTTE le categorie
  FOR permission_rec IN 
    SELECT id FROM categories
  LOOP
    -- Inserisci staff-categoria (se non esiste già)
    INSERT INTO staff_categories (user_id, category_id)
    VALUES (temp_user_id, permission_rec.id)
    ON CONFLICT (user_id, category_id) DO NOTHING;
    
    RAISE NOTICE '✅ Categoria assegnata: %', permission_rec.id;
  END LOOP;
  
  RAISE NOTICE '🎉 TUTTI I PERMESSI ASSEGNATI!';
  RAISE NOTICE '👤 Utente: temp@brixiarugby.it';
  RAISE NOTICE '🔑 Ruolo: admin';
  RAISE NOTICE '🚀 Ora dovrebbe vedere tutte le card!';
END $$;

-- =====================================
-- PASSO 3: VERIFICA FINALE
-- =====================================

-- Controlla i permessi assegnati
SELECT 
  'PERMESSI UTENTE TEMPORANEO' as controllo,
  COUNT(*) as numero_permessi
FROM user_permissions up
JOIN profiles p ON up.user_id = p.id
WHERE p.email = 'temp@brixiarugby.it';

-- Controlla le categorie assegnate
SELECT 
  'CATEGORIE UTENTE TEMPORANEO' as controllo,
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
-- MESSAGGIO FINALE
-- =====================================
SELECT '🎉 UTENTE TEMPORANEO CON TUTTI I PERMESSI!' as messaggio;
SELECT 'Ora dovrebbe vedere tutte le card e funzionalità!' as prossimo_passaggio;


