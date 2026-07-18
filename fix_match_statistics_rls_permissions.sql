-- =====================================================
-- SCRIPT PER CORREGGERE I PERMESSI RLS DI match_statistics
-- =====================================================
-- Questo script rende le policy meno restrittive per permettere il salvataggio

-- Elimina le policy esistenti
DROP POLICY IF EXISTS "Users can view match statistics for their categories" ON public.match_statistics;
DROP POLICY IF EXISTS "Users can insert match statistics for their categories" ON public.match_statistics;
DROP POLICY IF EXISTS "Users can update match statistics for their categories" ON public.match_statistics;
DROP POLICY IF EXISTS "Users can delete match statistics for their categories" ON public.match_statistics;

-- Policy più permissive per utenti autenticati
-- Permetti a tutti gli utenti autenticati di vedere le statistiche
CREATE POLICY "Authenticated users can view match statistics" ON public.match_statistics
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Permetti a tutti gli utenti autenticati di inserire statistiche
CREATE POLICY "Authenticated users can insert match statistics" ON public.match_statistics
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Permetti a tutti gli utenti autenticati di aggiornare statistiche
CREATE POLICY "Authenticated users can update match statistics" ON public.match_statistics
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Permetti a tutti gli utenti autenticati di eliminare statistiche
CREATE POLICY "Authenticated users can delete match statistics" ON public.match_statistics
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FINE SCRIPT
-- =====================================================
