-- ========================================
-- Script per fixare RLS sulla tabella user_roles
-- ========================================

-- 1. Verifica lo stato di RLS sulla tabella user_roles
SELECT 'Stato RLS su user_roles:' as info;
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'user_roles';

-- 2. Verifica le policy esistenti
SELECT 'Policy esistenti su user_roles:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_roles';

-- 3. Rimuovi eventuali policy esistenti problematiche
DROP POLICY IF EXISTS "users_view_user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_view_policy" ON public.user_roles;

-- 4. Crea policy permissive per user_roles
-- Policy per SELECT (lettura) - accesso pubblico
CREATE POLICY "user_roles_public_read" ON public.user_roles
FOR SELECT USING (true);

-- Policy per INSERT/UPDATE/DELETE - solo admin
CREATE POLICY "user_roles_admin_write" ON public.user_roles
FOR ALL USING (
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente'])
);

-- 5. Verifica le nuove policy
SELECT 'Nuove policy su user_roles:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_roles';

-- 6. Test di accesso
SELECT 'Test accesso user_roles:' as info;
SELECT COUNT(*) as total_roles FROM public.user_roles;
SELECT id, name, position_order FROM public.user_roles ORDER BY position_order;

-- ========================================
-- COMPLETATO! ✅
-- ========================================