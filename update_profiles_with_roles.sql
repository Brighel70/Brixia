-- ========================================
-- AGGIORNA PROFILI CON RUOLI - BRIXIA RUGBY
-- ========================================
-- Questo script collega i profili esistenti ai ruoli corretti

-- 1. Prima verifica la struttura attuale
SELECT 
  'Struttura tabella profiles:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Mostra i profili esistenti
SELECT 
  'Profili esistenti:' as info,
  id,
  full_name,
  role,
  user_role_id,
  email
FROM profiles
ORDER BY created_at;

-- 3. Mostra i ruoli disponibili
SELECT 
  'Ruoli disponibili:' as info,
  id,
  name,
  position_order
FROM user_roles
ORDER BY position_order;

-- 4. Aggiorna i profili esistenti con i ruoli corretti
-- Mappa i ruoli vecchi ai nuovi
UPDATE profiles 
SET user_role_id = (
  SELECT ur.id 
  FROM user_roles ur 
  WHERE ur.name = CASE 
    WHEN profiles.role = 'admin' THEN 'Admin'
    WHEN profiles.role = 'coach' THEN 'Allenatore'
    WHEN profiles.role = 'medic' THEN 'Medico'
    WHEN profiles.role = 'director' THEN 'Direttore Sportivo'
    ELSE 'Allenatore' -- Default fallback
  END
)
WHERE user_role_id IS NULL;

-- 5. Per i profili che hanno già un ruolo nel campo 'role' ma non nel formato corretto
-- Aggiorna anche il campo role per essere consistente
UPDATE profiles 
SET role = CASE 
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Admin') THEN 'Admin'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Dirigente') THEN 'Dirigente'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Segreteria') THEN 'Segreteria'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Direttore Sportivo') THEN 'Direttore Sportivo'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Direttore Tecnico') THEN 'Direttore Tecnico'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Allenatore') THEN 'Allenatore'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Team Manager') THEN 'Team Manager'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Accompagnatore') THEN 'Accompagnatore'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Player') THEN 'Player'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Preparatore') THEN 'Preparatore'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Medico') THEN 'Medico'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Fisio') THEN 'Fisio'
  WHEN user_role_id = (SELECT id FROM user_roles WHERE name = 'Famiglia') THEN 'Famiglia'
  ELSE 'Allenatore' -- Default fallback
END
WHERE user_role_id IS NOT NULL;

-- 6. Crea un utente admin di default se non esiste
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@brixia.local',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
ON CONFLICT (email) DO NOTHING;

-- 7. Crea il profilo admin se non esiste
INSERT INTO profiles (id, full_name, role, email, first_name, last_name, user_role_id)
SELECT 
  u.id,
  'Amministratore Brixia',
  'Admin',
  u.email,
  'Amministratore',
  'Brixia',
  (SELECT id FROM user_roles WHERE name = 'Admin')
FROM auth.users u 
WHERE u.email = 'admin@brixia.local'
ON CONFLICT (id) DO NOTHING;

-- 8. Verifica il risultato finale
SELECT 
  'Profili aggiornati:' as info,
  p.id,
  p.full_name,
  p.role,
  ur.name as ruolo_corretto,
  p.email
FROM profiles p
LEFT JOIN user_roles ur ON p.user_role_id = ur.id
ORDER BY p.created_at;

-- 9. Conta i profili per ruolo
SELECT 
  'Distribuzione ruoli:' as info,
  ur.name as ruolo,
  COUNT(p.id) as numero_utenti
FROM user_roles ur
LEFT JOIN profiles p ON ur.id = p.user_role_id
GROUP BY ur.name, ur.position_order
ORDER BY ur.position_order;


