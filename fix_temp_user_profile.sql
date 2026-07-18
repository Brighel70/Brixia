-- SCRIPT PER CORREGGERE IL PROFILO UTENTE TEMPORANEO
-- Risolve l'errore "Cannot coerce the result to a single JSON object"

-- =====================================
-- PASSO 1: VERIFICA UTENTE TEMPORANEO
-- =====================================

SELECT 
  'VERIFICA UTENTE TEMPORANEO' as step,
  id,
  full_name,
  email,
  role,
  person_id,
  created_at
FROM profiles 
WHERE email = 'temp@brixiarugby.it';

-- =====================================
-- PASSO 2: VERIFICA DUPLICATI
-- =====================================

SELECT 
  'CONTROLLO DUPLICATI' as step,
  COUNT(*) as total_profiles,
  email
FROM profiles 
WHERE email = 'temp@brixiarugby.it'
GROUP BY email;

-- =====================================
-- PASSO 3: ELIMINA DUPLICATI E CORREGGE
-- =====================================

DO $$
DECLARE
  temp_user_id uuid;
  profile_count integer;
BEGIN
  -- Conta i profili esistenti
  SELECT COUNT(*) INTO profile_count
  FROM profiles 
  WHERE email = 'temp@brixiarugby.it';
  
  RAISE NOTICE '🔍 Profili trovati per temp@brixiarugby.it: %', profile_count;
  
  IF profile_count > 1 THEN
    RAISE NOTICE '❌ Trovati duplicati! Elimino quelli extra...';
    
    -- Mantieni solo il primo profilo, elimina gli altri
    DELETE FROM profiles 
    WHERE email = 'temp@brixiarugby.it' 
    AND id NOT IN (
      SELECT id FROM profiles 
      WHERE email = 'temp@brixiarugby.it' 
      ORDER BY created_at ASC 
      LIMIT 1
    );
    
    RAISE NOTICE '✅ Duplicati eliminati!';
  END IF;
  
  -- Ottieni l'ID dell'utente temporaneo
  SELECT id INTO temp_user_id 
  FROM profiles 
  WHERE email = 'temp@brixiarugby.it'
  LIMIT 1;
  
  IF temp_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utente temporaneo non trovato!';
  END IF;
  
  RAISE NOTICE '🆔 ID utente temporaneo: %', temp_user_id;
  
  -- Aggiorna il profilo per assicurarsi che sia completo
  UPDATE profiles 
  SET 
    full_name = 'Utente Temporaneo',
    first_name = 'Utente',
    last_name = 'Temporaneo',
    role = 'Admin',
    phone = '+393356222225',
    person_id = NULL, -- Non ha person_id associato
    updated_at = NOW()
  WHERE id = temp_user_id;
  
  RAISE NOTICE '✅ Profilo aggiornato!';
  
END $$;

-- =====================================
-- PASSO 4: VERIFICA FINALE
-- =====================================

SELECT 
  'VERIFICA FINALE' as step,
  id,
  full_name,
  email,
  role,
  person_id,
  created_at,
  updated_at
FROM profiles 
WHERE email = 'temp@brixiarugby.it';

-- =====================================
-- PASSO 5: TEST QUERY SINGLE
-- =====================================

-- Simula la query che fa l'app
SELECT 
  'TEST QUERY SINGLE' as step,
  *
FROM profiles 
WHERE id = (
  SELECT id FROM profiles 
  WHERE email = 'temp@brixiarugby.it' 
  LIMIT 1
);

-- =====================================
-- MESSAGGIO FINALE
-- =====================================

SELECT '🎉 PROFILO UTENTE TEMPORANEO CORRETTO!' as messaggio;
SELECT '📧 Email: temp@brixiarugby.it' as credenziali;
SELECT '🔑 Password: 123456' as credenziali;
SELECT '👤 Ruolo: Admin' as credenziali;
SELECT '' as separatore;
SELECT '🚀 PROVA DI NUOVO IL LOGIN!' as prossimo_passaggio;



