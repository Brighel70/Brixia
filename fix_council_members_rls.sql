-- Fix RLS su council_members: la policy controllava profiles.role = 'amministratore'
-- ma TeamFlow usa profiles.role = 'Admin'. Permette INSERT/UPDATE/DELETE agli utenti Admin.

-- 1. Rimuovi la policy esistente
DROP POLICY IF EXISTS "Allow admins to manage council members" ON public.council_members;

-- 2. Crea policy corretta: Admin può gestire (INSERT, UPDATE, DELETE)
-- Controlla sia profiles.role (Admin, admin, amministratore) sia user_role_id -> user_roles.name = 'Admin'
CREATE POLICY "Allow admins to manage council members" ON public.council_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.user_roles ur ON ur.id = p.user_role_id
      WHERE p.id = auth.uid()
      AND (
        LOWER(TRIM(COALESCE(p.role, ''))) = 'admin'
        OR p.role = 'Admin'
        OR p.role = 'amministratore'
        OR (ur.name IS NOT NULL AND LOWER(TRIM(ur.name)) = 'admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      LEFT JOIN public.user_roles ur ON ur.id = p.user_role_id
      WHERE p.id = auth.uid()
      AND (
        LOWER(TRIM(COALESCE(p.role, ''))) = 'admin'
        OR p.role = 'Admin'
        OR p.role = 'amministratore'
        OR (ur.name IS NOT NULL AND LOWER(TRIM(ur.name)) = 'admin')
      )
    )
  );

-- Se ancora 403: alternativa per permettere a TUTTI gli utenti autenticati
-- (esegui solo se la policy sopra non funziona):
-- DROP POLICY IF EXISTS "Allow admins to manage council members" ON public.council_members;
-- CREATE POLICY "Allow authenticated to manage council members" ON public.council_members
--   FOR ALL USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');
