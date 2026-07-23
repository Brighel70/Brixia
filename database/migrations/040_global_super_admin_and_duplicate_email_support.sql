-- =============================================================================
-- 040 - Super Admin globale e tracciamento liste gara
--
-- Il Super Admin e' una proprieta' dell'identita' autenticata (profiles.id =
-- auth.users.id), non dell'indirizzo scritto in una scheda people. In questo
-- modo una persona che usa la stessa email non ottiene privilegi speciali.
-- =============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.match_lists
  ADD COLUMN IF NOT EXISTS created_by_profile_id uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Le liste storiche continuano a conservare created_by (people.id). Per il
-- Super Admin globale l'autore persona non esiste intenzionalmente.
ALTER TABLE public.match_lists
  ALTER COLUMN created_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND profile.is_super_admin IS TRUE
  );
$$;

-- Mantiene il comportamento degli Admin normali e aggiunge il bypass globale
-- solo all'identita' autenticata contrassegnata come Super Admin.
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = auth.uid()
      AND (
        profile.is_super_admin IS TRUE
        OR lower(trim(coalesce(profile.role, ''))) = 'admin'
      )
  );
$$;

-- Nessun client puo' promuovere se stesso: il flag viene impostato solo dal
-- proprietario del database o da un processo server esplicitamente autorizzato.
CREATE OR REPLACE FUNCTION public.protect_super_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() IN ('anon', 'authenticated')
    AND (
      (TG_OP = 'INSERT' AND NEW.is_super_admin IS TRUE)
      OR (TG_OP = 'UPDATE' AND NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin)
    ) THEN
    RAISE EXCEPTION 'Il flag Super Admin puo'' essere modificato solo dal sistema di amministrazione';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_flag_on_profiles ON public.profiles;
CREATE TRIGGER protect_super_admin_flag_on_profiles
  BEFORE INSERT OR UPDATE OF is_super_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_flag();

-- Bootstrap dell'account di amministrazione globale indicato dal proprietario.
-- Il collegamento e' fatto con l'UUID di auth.users: l'email da sola non basta
-- e la password viene verificata esclusivamente da Supabase Auth al login.
UPDATE public.profiles profile
SET is_super_admin = true
FROM auth.users auth_user
WHERE profile.id = auth_user.id
  AND lower(trim(auth_user.email)) = 'andreabulgari@me.com';

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.protect_super_admin_flag() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- Le liste gara create dal Super Admin sono attribuite al profilo autenticato;
-- gli operatori ordinari restano attribuiti alla loro scheda persona.
DROP POLICY IF EXISTS match_lists_insert_authorized ON public.match_lists;
CREATE POLICY match_lists_insert_authorized
  ON public.match_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      public.is_super_admin()
      AND created_by IS NULL
      AND created_by_profile_id = auth.uid()
    )
    OR (
      NOT public.is_super_admin()
      AND public.is_operational_staff()
      AND public.has_app_permission('events.edit')
      AND public.can_manage_activity_category(category_id)
      AND created_by = public.get_my_person_id()
      AND (created_by_profile_id IS NULL OR created_by_profile_id = auth.uid())
    )
  );

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
