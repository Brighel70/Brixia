-- Script semplificato per creare utente temporaneo
-- Usa l'API di Supabase per creare l'utente (più sicuro)
-- Esegui questo script nel SQL Editor di Supabase

-- =====================================
-- PASSO 1: PULISCI EVENTUALI RESIDUI
-- =====================================

-- Elimina eventuali profili esistenti
DELETE FROM profiles WHERE email = 'temp@brixiarugby.it';

-- Elimina eventuali utenti auth esistenti
DELETE FROM auth.users WHERE email = 'temp@brixiarugby.it';

-- =====================================
-- PASSO 2: CREA UTENTE CON FUNZIONE SUPABASE
-- =====================================

-- NOTA: Per creare un utente in Supabase, è meglio usare l'API o il dashboard
-- Questo script crea direttamente nel database (solo per sviluppo)

DO $$
DECLARE
  new_user_id uuid;
  hashed_password text;
BEGIN
  -- Genera un nuovo UUID
  new_user_id := gen_random_uuid();
  
  -- Hash della password 'TempPass123!' usando bcrypt
  -- NOTA: In produzione usa l'API di Supabase per creare utenti
  hashed_password := crypt('TempPass123!', gen_salt('bf', 10));
  
  RAISE NOTICE '🆔 Nuovo ID generato: %', new_user_id;
  
  -- Crea l'utente in auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'temp@brixiarugby.it',
    hashed_password,
    now(), -- Email confermata immediatamente
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    'authenticated',
    'authenticated'
  );
  
  RAISE NOTICE '✅ Utente auth creato!';
  
  -- Crea il profilo corrispondente
  INSERT INTO profiles (
    id,
    full_name,
    first_name,
    last_name,
    email,
    role,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    'Utente Temporaneo',
    'Utente',
    'Temporaneo',
    'temp@brixiarugby.it',
    'Admin',
    now(),
    now()
  );
  
  RAISE NOTICE '✅ Profilo creato!';
  
  -- Assegna tutte le categorie staff (se esistono)
  INSERT INTO staff_categories (user_id, category_id)
  SELECT new_user_id, id FROM categories
  WHERE active = true
  ON CONFLICT (user_id, category_id) DO NOTHING;
  
  RAISE NOTICE '✅ Categorie assegnate!';
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 UTENTE TEMPORANEO CREATO CON SUCCESSO!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📧 EMAIL: temp@brixiarugby.it';
  RAISE NOTICE '🔑 PASSWORD: TempPass123!';
  RAISE NOTICE '🆔 ID UTENTE: %', new_user_id;
  RAISE NOTICE '👤 RUOLO: Admin';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 ORA PUOI FARE LOGIN CON QUESTE CREDENZIALI!';
  
END $$;

-- =====================================
-- PASSO 3: VERIFICA
-- =====================================

SELECT 
  'VERIFICA UTENTE' as controllo,
  p.id as profile_id,
  p.full_name,
  p.email,
  p.role,
  u.id as auth_user_id,
  u.email_confirmed_at,
  CASE 
    WHEN u.id IS NULL THEN '❌ MANCA in auth.users'
    WHEN p.id = u.id THEN '✅ TUTTO OK'
    ELSE '❌ ID NON CORRISPONDONO'
  END as status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE p.email = 'temp@brixiarugby.it';
