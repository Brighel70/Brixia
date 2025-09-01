-- SCRIPT SEMPLICE PER DARE TUTTI I PERMESSI ALL'UTENTE TEMPORANEO
-- Il tuo sistema usa staff_categories per i permessi, non user_permissions

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
    -- Inserisci staff-categoria (se non esiste già)
    INSERT INTO staff_categories (user_id, category_id)
    VALUES (temp_user_id, category_rec.id)
    ON CONFLICT (user_id, category_id) DO NOTHING;
    
    RAISE NOTICE '✅ Categoria assegnata: % (%s)', category_rec.name, category_rec.code;
  END LOOP;
  
  RAISE NOTICE '🎉 TUTTE LE CATEGORIE ASSEGNATE!';
  RAISE NOTICE '👤 Utente: temp@brixiarugby.it';
  RAISE NOTICE '🔑 Ruolo: admin';
  RAISE NOTICE '🚀 Ora dovrebbe vedere tutte le card!';
END $$;

-- =====================================
-- PASSO 3: VERIFICA FINALE
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
-- MESSAGGIO FINALE
-- =====================================
SELECT '🎉 UTENTE TEMPORANEO CON TUTTE LE CATEGORIE!' as messaggio;
SELECT 'Ora dovrebbe vedere tutte le card e funzionalità!' as prossimo_passaggio;
