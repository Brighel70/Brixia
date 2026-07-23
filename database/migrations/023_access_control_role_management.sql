-- =============================================================================
-- 023_access_control_role_management.sql
-- =============================================================================
-- Fondazione accessi: una sola fonte operativa per i permessi TeamFlow.
-- Le modifiche a role_permissions e user_permissions passano da RPC atomiche.
-- Non attiva ancora RLS su persone, eventi, presenze, infortuni o quote.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.has_app_permission(p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role_id uuid;
  v_role_name text;
BEGIN
  IF v_user_id IS NULL OR p_permission_key IS NULL OR btrim(p_permission_key) = '' THEN
    RETURN false;
  END IF;

  IF public.is_app_admin() THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = v_user_id AND p.name = p_permission_key AND up.is_granted IS FALSE
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = v_user_id AND p.name = p_permission_key AND up.is_granted IS TRUE
  ) THEN
    RETURN true;
  END IF;

  SELECT pr.user_role_id, pr.role INTO v_role_id, v_role_name
  FROM public.profiles pr WHERE pr.id = v_user_id;

  IF v_role_id IS NULL AND v_role_name IS NOT NULL THEN
    SELECT ur.id INTO v_role_id FROM public.user_roles ur WHERE ur.name ILIKE v_role_name LIMIT 1;
  END IF;

  RETURN v_role_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = v_role_id AND p.name = p_permission_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_app_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_app_permission(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_app_permission(text) TO authenticated, service_role;

INSERT INTO public.permissions (name, description, category, position_order)
VALUES ('users.manage_permissions', 'Gestisce i permessi assegnati ai ruoli e le eccezioni personali.', 'users', 999)
ON CONFLICT (name) DO UPDATE
SET description = EXCLUDED.description, category = EXCLUDED.category;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur CROSS JOIN public.permissions p
WHERE ur.name ILIKE 'Admin' AND p.name = 'users.manage_permissions'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_replace_role_permissions(
  p_role_id uuid,
  p_permission_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_permission_ids uuid[] := COALESCE(p_permission_ids, ARRAY[]::uuid[]);
BEGIN
  IF NOT public.has_app_permission('users.manage_permissions') THEN
    RAISE EXCEPTION 'Permesso insufficiente per modificare i ruoli';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE id = p_role_id) THEN
    RAISE EXCEPTION 'Ruolo non trovato';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_permission_ids) AS requested(permission_id)
    LEFT JOIN public.permissions p ON p.id = requested.permission_id
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Uno o più permessi non esistono';
  END IF;

  DELETE FROM public.role_permissions WHERE role_id = p_role_id;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT p_role_id, requested.permission_id
  FROM (SELECT DISTINCT permission_id FROM unnest(v_permission_ids) AS ids(permission_id)) AS requested;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_permission(
  p_user_id uuid,
  p_permission_id uuid,
  p_is_granted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.has_app_permission('users.manage_permissions') THEN
    RAISE EXCEPTION 'Permesso insufficiente per modificare i permessi personali';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Utente non trovato';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE id = p_permission_id) THEN
    RAISE EXCEPTION 'Permesso non trovato';
  END IF;

  DELETE FROM public.user_permissions WHERE user_id = p_user_id AND permission_id = p_permission_id;
  INSERT INTO public.user_permissions (user_id, permission_id, is_granted)
  VALUES (p_user_id, p_permission_id, p_is_granted);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_replace_role_permissions(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_replace_role_permissions(uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.admin_set_user_permission(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_permission(uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_replace_role_permissions(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_permission(uuid, uuid, boolean) TO authenticated, service_role;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.role_permissions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_permissions FROM authenticated;
REVOKE ALL ON TABLE public.role_permissions FROM anon, PUBLIC;
REVOKE ALL ON TABLE public.user_permissions FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.role_permissions TO authenticated;
GRANT SELECT ON TABLE public.user_permissions TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
