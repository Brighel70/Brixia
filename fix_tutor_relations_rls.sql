-- ========================================
-- FIX: RLS Policy per tutor_athlete_relations
-- ========================================

-- Verifica le policy esistenti
SELECT 'POLICY ESISTENTI:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'tutor_athlete_relations';

-- Rimuovi tutte le policy esistenti per tutor_athlete_relations
DROP POLICY IF EXISTS "tutor_athlete_relations_select_policy" ON public.tutor_athlete_relations;
DROP POLICY IF EXISTS "tutor_athlete_relations_insert_policy" ON public.tutor_athlete_relations;
DROP POLICY IF EXISTS "tutor_athlete_relations_update_policy" ON public.tutor_athlete_relations;
DROP POLICY IF EXISTS "tutor_athlete_relations_delete_policy" ON public.tutor_athlete_relations;
DROP POLICY IF EXISTS "users_view_tutor_athlete_relations" ON public.tutor_athlete_relations;

-- Crea nuove policy permissive per tutor_athlete_relations
-- Le relazioni tutor-atleta devono essere accessibili a tutti gli utenti autenticati

-- Policy per SELECT (lettura)
CREATE POLICY "tutor_relations_public_read" ON public.tutor_athlete_relations
FOR SELECT USING (
  -- Tutti gli utenti autenticati possono leggere
  auth.uid() IS NOT NULL
);

-- Policy per INSERT (inserimento)
CREATE POLICY "tutor_relations_public_insert" ON public.tutor_athlete_relations
FOR INSERT WITH CHECK (
  -- Tutti gli utenti autenticati possono inserire
  auth.uid() IS NOT NULL
);

-- Policy per UPDATE (aggiornamento)
CREATE POLICY "tutor_relations_public_update" ON public.tutor_athlete_relations
FOR UPDATE USING (
  -- Tutti gli utenti autenticati possono aggiornare
  auth.uid() IS NOT NULL
);

-- Policy per DELETE (eliminazione)
CREATE POLICY "tutor_relations_public_delete" ON public.tutor_athlete_relations
FOR DELETE USING (
  -- Tutti gli utenti autenticati possono eliminare
  auth.uid() IS NOT NULL
);

-- Verifica le nuove policy
SELECT 'NUOVE POLICY:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'tutor_athlete_relations';

-- Test di accesso
SELECT 'TEST ACCESSO:' as info;
SELECT COUNT(*) as total_relations FROM public.tutor_athlete_relations;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS TUTOR_ATHLETE_RELATIONS RISOLTO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Le relazioni tutor-atleta sono ora accessibili';
  RAISE NOTICE '📋 Prova di nuovo a creare il tutor';
  RAISE NOTICE '';
END $$;








