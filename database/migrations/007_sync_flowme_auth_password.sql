-- =============================================================================
-- 007_sync_flowme_auth_password.sql
-- Allinea AUTOMATICAMENTE la password Auth quando cambi Codice FlowMe / TeamFlow.
--
-- Esegui questo script UNA VOLTA in Supabase → SQL Editor → Run.
-- Dopo: ogni salvataggio/rigenerazione codice aggiorna subito Auth.
-- Al login FlowMe, la RPC riallinea di nuovo (rete di sicurezza).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Password Auth = codice passato (dopo verifica che il codice sia quello in anagrafica)
CREATE OR REPLACE FUNCTION public.sync_auth_password_by_email(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_password text := trim(p_password);
  v_user_id uuid;
  v_person_id uuid;
  v_full_name text;
BEGIN
  IF v_email = '' OR v_password = '' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NULL; -- il client creerà l'utente al primo login
  END IF;

  -- bcrypt (compatibile con GoTrue / Supabase Auth)
  UPDATE auth.users
  SET
    encrypted_password = crypt(v_password, gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
  WHERE id = v_user_id;

  SELECT id, full_name INTO v_person_id, v_full_name
  FROM public.people
  WHERE lower(trim(coalesce(email, ''))) = v_email
    AND status = 'active'
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_person_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, role, person_id, full_name)
    VALUES (v_user_id, v_email, 'Famiglia', v_person_id, coalesce(v_full_name, v_email))
    ON CONFLICT (id) DO UPDATE
      SET person_id = COALESCE(public.profiles.person_id, EXCLUDED.person_id),
          email = COALESCE(NULLIF(public.profiles.email, ''), EXCLUDED.email);
  END IF;

  RETURN v_user_id;
END;
$$;

-- Verifica email+codice (FlowMe oppure TeamFlow), poi allinea password
CREATE OR REPLACE FUNCTION public.sync_flowme_auth_password(p_email text, p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_code text := trim(p_code);
  v_ok boolean;
BEGIN
  IF v_email = '' OR v_code = '' THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.people
    WHERE lower(trim(coalesce(email, ''))) = v_email
      AND status = 'active'
      AND (
        trim(coalesce(invite_code, '')) = v_code
        OR trim(coalesce(invite_code_teamflow, '')) = v_code
      )
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  RETURN public.sync_auth_password_by_email(v_email, v_code);
END;
$$;

-- Trigger: ogni volta che salvi/rigeneri un codice → password Auth = quel codice
CREATE OR REPLACE FUNCTION public.trg_people_sync_invite_auth_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- Codice FlowMe cambiato (priorità: se entrambi cambiano, FlowMe vince per ultimo)
  IF NEW.invite_code_teamflow IS NOT NULL AND trim(NEW.invite_code_teamflow) <> '' THEN
    IF TG_OP = 'INSERT'
       OR NEW.invite_code_teamflow IS DISTINCT FROM OLD.invite_code_teamflow THEN
      PERFORM public.sync_auth_password_by_email(NEW.email, NEW.invite_code_teamflow);
    END IF;
  END IF;

  IF NEW.invite_code IS NOT NULL AND trim(NEW.invite_code) <> '' THEN
    IF TG_OP = 'INSERT'
       OR NEW.invite_code IS DISTINCT FROM OLD.invite_code THEN
      PERFORM public.sync_auth_password_by_email(NEW.email, NEW.invite_code);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_people_sync_invite_auth_password ON public.people;
CREATE TRIGGER trg_people_sync_invite_auth_password
  AFTER INSERT OR UPDATE OF invite_code, invite_code_teamflow, email
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_people_sync_invite_auth_password();

REVOKE ALL ON FUNCTION public.sync_auth_password_by_email(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_flowme_auth_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_auth_password_by_email(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_flowme_auth_password(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.sync_flowme_auth_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_flowme_auth_password(text, text) TO service_role;

-- Allinea SUBITO tutti gli utenti che hanno già un Codice FlowMe
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT email, invite_code
    FROM public.people
    WHERE status = 'active'
      AND email IS NOT NULL
      AND invite_code IS NOT NULL
      AND trim(invite_code) <> ''
  LOOP
    BEGIN
      PERFORM public.sync_auth_password_by_email(r.email, r.invite_code);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'sync skip %: %', r.email, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
