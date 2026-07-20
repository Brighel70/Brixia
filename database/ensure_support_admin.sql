-- ========================================
-- TeamFlow — Admin di assistenza (idempotente)
-- ========================================
-- Esegui questo script UNA VOLTA su ogni nuovo progetto Supabase cliente
-- (SQL Editor → Run). Puoi rilanciarlo senza errori.
--
-- Credenziali di login TeamFlow:
--   Email:    andreabulgari@me.com
--   Password: Teamflow@007
--
-- Dopo il primo login in produzione, cambia la password da Dashboard Auth
-- oppure decommenta il blocco "RESET PASSWORD" in fondo.
-- ========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
  v_email text := 'andreabulgari@me.com';
  v_password text := 'Teamflow@007';
  v_role_id uuid;
  v_role_value text := 'Admin';
BEGIN
  -- 1) Utente Auth (crea solo se non esiste)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email);

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

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
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Amministratore Supporto'),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    RAISE NOTICE 'Creato auth.users per % (id=%)', v_email, v_user_id;
  ELSE
    -- Allinea sempre password e conferma email (necessario se l'utente esisteva già)
    UPDATE auth.users
    SET
      encrypted_password = crypt(v_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = v_user_id;
    RAISE NOTICE 'Utente % già presente: password aggiornata (id=%)', v_email, v_user_id;
  END IF;

  -- 2) Identity email (necessaria per signInWithPassword)
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities
    WHERE user_id = v_user_id AND provider = 'email'
  ) THEN
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      'email',
      v_user_id::text,
      now(),
      now(),
      now()
    );
    RAISE NOTICE 'Creata auth.identities email per %', v_email;
  END IF;

  -- 3) Collegamento a user_roles.Admin se esiste
  SELECT id INTO v_role_id
  FROM public.user_roles
  WHERE name ILIKE 'Admin'
  LIMIT 1;

  -- 4) Profilo Admin (upsert)
  -- Nota: sui DB legacy con enum role_enum usa 'admin' minuscolo.
  -- Sui progetti TeamFlow attuali profiles.role è testo con valore 'Admin'.
  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    email,
    first_name,
    last_name,
    user_role_id,
    updated_at
  ) VALUES (
    v_user_id,
    'Amministratore Supporto',
    v_role_value,
    v_email,
    'Amministratore',
    'Supporto',
    v_role_id,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    user_role_id = COALESCE(EXCLUDED.user_role_id, public.profiles.user_role_id),
    updated_at = now();

  RAISE NOTICE 'Profilo Admin di assistenza pronto per %', v_email;
END $$;

-- Verifica
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  p.full_name,
  p.role,
  p.user_role_id,
  EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  ) AS has_email_identity
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = 'andreabulgari@me.com';

-- ========================================
-- RESET PASSWORD (opzionale)
-- Decommenta e riesegui per ripristinare la password documentata.
-- ========================================
-- UPDATE auth.users
-- SET
--   encrypted_password = crypt('Teamflow@007', gen_salt('bf')),
--   updated_at = now()
-- WHERE lower(email) = 'andreabulgari@me.com';
