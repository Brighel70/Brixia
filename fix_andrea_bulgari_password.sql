-- SCRIPT PER CORREGGERE LA PASSWORD DI ANDREA BULGARI
-- Il login fallisce con "Invalid login credentials" - problema di hash password

-- =====================================
-- METODO 1: RESET SEMPLICE DELLA PASSWORD
-- =====================================

-- Aggiorna la password con hash corretto
UPDATE auth.users 
SET 
  encrypted_password = crypt('123456', gen_salt('bf')),
  updated_at = now()
WHERE email = 'ds@brixiarugby.it';

-- Verifica che sia stato aggiornato
SELECT 
  'Password aggiornata' as status,
  email,
  email_confirmed_at,
  updated_at
FROM auth.users 
WHERE email = 'ds@brixiarugby.it';

-- =====================================
-- METODO 2: SE IL METODO 1 NON FUNZIONA
-- =====================================

-- Elimina e ricrea completamente l'utente
DO $$
DECLARE
  profile_id uuid;
BEGIN
  -- Ottieni l'ID da profiles
  SELECT id INTO profile_id 
  FROM profiles 
  WHERE email = 'ds@brixiarugby.it';
  
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Profilo non trovato per ds@brixiarugby.it';
  END IF;
  
  -- Elimina l'utente esistente
  DELETE FROM auth.users WHERE email = 'ds@brixiarugby.it';
  
  -- Ricrea l'utente con password corretta
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    aud,
    role
  ) VALUES (
    profile_id,
    '00000000-0000-0000-0000-000000000000',
         'ds@brixiarugby.it',
     crypt('123456', gen_salt('bf')),
     now(),
    null,
    '',
    null,
    '',
    null,
    '',
    '',
    null,
    null,
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Andrea Bulgari"}',
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    '',
    0,
    null,
    '',
    null,
    false,
    null,
    'authenticated',
    'authenticated'
  );
  
  RAISE NOTICE '✅ Utente Andrea Bulgari ricreato con successo!';
END $$;

-- =====================================
-- VERIFICA FINALE
-- =====================================

-- Test della password
DO $$
DECLARE
  user_record record;
  password_match boolean;
BEGIN
  SELECT * INTO user_record 
  FROM auth.users 
  WHERE email = 'ds@brixiarugby.it';
  
  IF user_record.id IS NOT NULL THEN
         SELECT (user_record.encrypted_password = crypt('123456', user_record.encrypted_password)) 
     INTO password_match;
    
    IF password_match THEN
      RAISE NOTICE '✅ TEST PASSWORD: Corretta per ds@brixiarugby.it';
    ELSE
      RAISE NOTICE '❌ TEST PASSWORD: Non corretta';
    END IF;
  ELSE
    RAISE NOTICE '❌ Utente non trovato';
  END IF;
END $$;

-- Controllo finale
SELECT 
  'CONTROLLO FINALE' as step,
  email,
  email_confirmed_at,
  created_at,
  updated_at
FROM auth.users 
WHERE email = 'ds@brixiarugby.it';
