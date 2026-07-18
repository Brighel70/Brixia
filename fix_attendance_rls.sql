-- ========================================
-- Script per fixare RLS sulla tabella attendance
-- ========================================

-- 1. Verifica lo stato di RLS sulla tabella attendance
SELECT 'Stato RLS su attendance:' as info;
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'attendance';

-- 2. Verifica le policy esistenti su attendance
SELECT 'Policy esistenti su attendance:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'attendance';

-- 3. Rimuovi eventuali policy esistenti problematiche
DROP POLICY IF EXISTS "users_view_attendance" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;

-- 4. Crea policy permissive per attendance
-- Policy per SELECT (lettura) - accesso per utenti autenticati
CREATE POLICY "attendance_authenticated_read" ON public.attendance
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy per INSERT (inserimento) - accesso per utenti autenticati
CREATE POLICY "attendance_authenticated_insert" ON public.attendance
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per UPDATE (aggiornamento) - accesso per utenti autenticati
CREATE POLICY "attendance_authenticated_update" ON public.attendance
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policy per DELETE (eliminazione) - accesso per utenti autenticati
CREATE POLICY "attendance_authenticated_delete" ON public.attendance
FOR DELETE USING (auth.uid() IS NOT NULL);

-- 5. Verifica le nuove policy
SELECT 'Nuove policy su attendance:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'attendance';

-- 6. Test di accesso
SELECT 'Test accesso attendance:' as info;
SELECT COUNT(*) as total_attendance FROM public.attendance;

-- ========================================
-- COMPLETATO! ✅
-- ========================================








