-- SCRIPT PER CREARE UTENTE TEMPORANEO COMPLETO DA ZERO
-- Risolve il problema "Utente temporaneo non trovato"

-- =====================================
-- PASSO 1: PULISCI EVENTUALI RESIDUI
-- =====================================

-- Elimina eventuali profili esistenti
DELETE FROM profiles WHERE email = 'temp@brixiarugby.it';

-- Elimina eventuali utenti auth esistenti
DELETE FROM auth.users WHERE email = 'temp@brixiarugby.it';

-- =====================================
-- PASSO 2: CREA UTENTE TEMPORANEO COMPLETO
-- =====================================

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Genera un nuovo UUID univoco
  new_user_id := gen_random_uuid();
  
  RAISE NOTICE '🆔 Nuovo ID generato: %', new_user_id;
  
  -- =====================================
  -- CREA L'UTENTE IN AUTH.USERS
  -- =====================================
  
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
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'temp@brixiarugby.it',
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
    '{"full_name":"Utente Temporaneo"}',
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
  
  RAISE NOTICE '✅ Utente auth creato!';
  
  -- =====================================
  -- CREA IL PROFILO CORRISPONDENTE
  -- =====================================
  
  INSERT INTO profiles (
    id,
    full_name,
    first_name,
    last_name,
    email,
    role,
    phone,
    created_at,
    updated_at,
    person_id
  ) VALUES (
    new_user_id,
    'Utente Temporaneo',
    'Utente',
    'Temporaneo',
    'temp@brixiarugby.it',
    'Admin',
    '+393356222225',
    now(),
    now(),
    null
  );
  
  RAISE NOTICE '✅ Profilo creato!';
  
  -- =====================================
  -- ASSEGNA TUTTI I PERMESSI ADMIN
  -- =====================================
  
  -- Assegna TUTTI i permessi disponibili (se esistono)
  INSERT INTO user_permissions (user_id, permission_id)
  SELECT new_user_id, id FROM permissions
  ON CONFLICT (user_id, permission_id) DO NOTHING;
  
  -- Assegna TUTTE le categorie (se esistono)
  INSERT INTO staff_categories (user_id, category_id)
  SELECT new_user_id, id FROM categories
  ON CONFLICT (user_id, category_id) DO NOTHING;
  
  RAISE NOTICE '✅ Permessi assegnati!';
  
  RAISE NOTICE '🎉 UTENTE TEMPORANEO CREATO CON SUCCESSO!';
  RAISE NOTICE '📧 Email: temp@brixiarugby.it';
  RAISE NOTICE '🔑 Password: 123456';
  RAISE NOTICE '🆔 ID: %', new_user_id;
  RAISE NOTICE '👤 Ruolo: Admin';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 ORA PUOI FARE LOGIN!';
  
END $$;

-- =====================================
-- PASSO 3: VERIFICA FINALE
-- =====================================

-- Controlla che tutto sia a posto
SELECT 
  'VERIFICA UTENTE TEMPORANEO' as controllo,
  p.id as profile_id,
  p.full_name,
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
WHERE p.email = 'temp@brixiarugby.it';

-- Test della password
DO $$
DECLARE
  user_record record;
  password_match boolean;
BEGIN
  SELECT * INTO user_record 
  FROM auth.users 
  WHERE email = 'temp@brixiarugby.it';
  
  IF user_record.id IS NOT NULL THEN
    SELECT (user_record.encrypted_password = crypt('123456', user_record.encrypted_password)) 
    INTO password_match;
    
    IF password_match THEN
      RAISE NOTICE '✅ TEST PASSWORD: Corretta per temp@brixiarugby.it';
    ELSE
      RAISE NOTICE '❌ TEST PASSWORD: Non corretta';
    END IF;
  ELSE
    RAISE NOTICE '❌ Utente non trovato';
  END IF;
END $$;

-- =====================================
-- PASSO 4: TEST QUERY SINGLE
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

SELECT '🎉 UTENTE TEMPORANEO PRONTO!' as messaggio;
SELECT 'Email: temp@brixiarugby.it' as credenziali;
SELECT 'Password: 123456' as credenziali;
SELECT 'Ruolo: Admin' as credenziali;
SELECT '' as separatore;
SELECT '🚀 FAI LOGIN E POI CREA L''UTENTE VERO!' as prossimo_passaggio;



