-- =====================================================
-- CORREZIONE POLICY RLS PER TABELLA match_lists
-- =====================================================

-- Elimina le policy esistenti che causano problemi
DROP POLICY IF EXISTS "Users can view match lists for their categories" ON public.match_lists;
DROP POLICY IF EXISTS "Users can insert match lists for their categories" ON public.match_lists;
DROP POLICY IF EXISTS "Users can update their own match lists" ON public.match_lists;
DROP POLICY IF EXISTS "Users can delete their own match lists" ON public.match_lists;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.match_lists;

-- Crea policy SEMPLICI che permettono a tutti gli utenti autenticati di fare tutto
-- Questo risolve il problema di sincronizzazione tra web app e mobile app

-- Policy per SELECT (visualizzare)
CREATE POLICY "Allow authenticated users to view all match lists" ON public.match_lists
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy per INSERT (creare)
CREATE POLICY "Allow authenticated users to insert match lists" ON public.match_lists
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per UPDATE (modificare)
CREATE POLICY "Allow authenticated users to update match lists" ON public.match_lists
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policy per DELETE (eliminare)
CREATE POLICY "Allow authenticated users to delete match lists" ON public.match_lists
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FINE SCRIPT
-- =====================================================



