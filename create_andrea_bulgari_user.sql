-- SCRIPT COMPLETO PER CREARE L'UTENTE ANDREA BULGARI
-- Esegui questo script passo per passo nel tuo Supabase SQL Editor

-- ================================
-- PASSO 1: VERIFICA SITUAZIONE ATTUALE
-- ================================

-- 1A. Controlla se esiste in auth.users
SELECT 
  'CONTROLLO AUTH.USERS' as controllo,
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'ds@brixiarugby.it';

-- 1B. Controlla se esiste in profiles  
SELECT 
  'CONTROLLO PROFILES' as controllo,
  id,
  full_name,
  first_name,
  last_name,
  email,
  role,
  created_at
FROM profiles 
WHERE email = 'ds@brixiarugby.it';

-- ================================
-- PASSO 2: CREA L'UTENTE (solo se manca)
-- ================================

-- 2A. Prima ottieni l'ID esatto da profiles
DO $$
DECLARE
  profile_id uuid;
  user_exists boolean := false;
BEGIN
  -- Controlla se l'utente esiste già in auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE email = 'ds@brixiarugby.it'
  ) INTO user_exists;
  
  IF user_exists THEN
    RAISE NOTICE '✅ Utente già esistente in auth.users';
  ELSE
    -- Ottieni l'ID di Andrea Bulgari da profiles
    SELECT id INTO profile_id 
    FROM profiles 
    WHERE email = 'ds@brixiarugby.it';
    
    IF profile_id IS NULL THEN
      RAISE EXCEPTION '❌ Profilo non trovato per ds@brixiarugby.it';
    END IF;
    
    -- Crea l'utente in auth.users
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      email_confirm_token,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role
    ) VALUES (
      profile_id,
      'ds@brixiarugby.it',
      crypt('Brixi@15', gen_salt('bf')),
      now(),
      '',
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Andrea Bulgari"}',
      'authenticated',
      'authenticated'
    );
    
    RAISE NOTICE '✅ Utente Andrea Bulgari creato con successo!';
    RAISE NOTICE 'ID: %', profile_id;
    RAISE NOTICE 'Email: ds@brixiarugby.it';
    RAISE NOTICE 'Password: Brixi@15';
  END IF;
END $$;

-- ================================
-- PASSO 3: VERIFICA FINALE
-- ================================

-- 3A. Verifica che tutto sia a posto
SELECT 
  'VERIFICA FINALE' as controllo,
  p.id as profile_id,
  COALESCE(p.full_name, p.first_name || ' ' || p.last_name) as nome_completo,
  p.email as profile_email,
  p.role,
  u.id as auth_user_id,
  u.email as auth_email,
  u.email_confirmed_at,
  CASE 
    WHEN u.id IS NULL THEN '❌ MANCA in auth.users'
    WHEN p.id = u.id THEN '✅ TUTTO OK - ID CORRISPONDONO'
    ELSE '❌ ID NON CORRISPONDONO'
  END as status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.email = 'ds@brixiarugby.it';

-- 3B. Test di login simulato (verifica password)
DO $$
DECLARE
  user_record record;
  password_match boolean;
BEGIN
  -- Ottieni il record utente
  SELECT * INTO user_record 
  FROM auth.users 
  WHERE email = 'ds@brixiarugby.it';
  
  IF user_record.id IS NOT NULL THEN
    -- Verifica la password
    SELECT (user_record.encrypted_password = crypt('Brixi@15', user_record.encrypted_password)) 
    INTO password_match;
    
    IF password_match THEN
      RAISE NOTICE '✅ LOGIN TEST: Password corretta per ds@brixiarugby.it';
    ELSE
      RAISE NOTICE '❌ LOGIN TEST: Password non corretta';
    END IF;
  ELSE
    RAISE NOTICE '❌ LOGIN TEST: Utente non trovato';
  END IF;
END $$;

-- ================================
-- MESSAGGIO FINALE
-- ================================
SELECT '🎉 SCRIPT COMPLETATO! Ora prova a fare login con:' as messaggio;
SELECT 'Email: ds@brixiarugby.it' as credenziali;
SELECT 'Password: Brixi@15' as credenziali;


