-- =====================================================
-- CORREZIONE POLICY RLS PER TABELLA injury_activities
-- =====================================================

-- Elimina le policy esistenti se esistono
DROP POLICY IF EXISTS "Allow authenticated users to view injury activities" ON public.injury_activities;
DROP POLICY IF EXISTS "Allow authenticated users to insert injury activities" ON public.injury_activities;
DROP POLICY IF EXISTS "Allow authenticated users to update injury activities" ON public.injury_activities;
DROP POLICY IF EXISTS "Allow authenticated users to delete injury activities" ON public.injury_activities;

-- Crea policy SEMPLICI che permettono a tutti gli utenti autenticati di fare tutto
-- Questo risolve il problema di accesso alle attività degli infortuni

-- Policy per SELECT (visualizzare)
CREATE POLICY "Allow authenticated users to view injury activities" ON public.injury_activities
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy per INSERT (creare)
CREATE POLICY "Allow authenticated users to insert injury activities" ON public.injury_activities
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per UPDATE (modificare)
CREATE POLICY "Allow authenticated users to update injury activities" ON public.injury_activities
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policy per DELETE (eliminare)
CREATE POLICY "Allow authenticated users to delete injury activities" ON public.injury_activities
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FINE SCRIPT
-- =====================================================



