-- =====================================================
-- CORREZIONE POLICY RLS PER TABELLA injuries
-- =====================================================

-- Elimina le policy esistenti se esistono
DROP POLICY IF EXISTS "Allow authenticated users to view injuries" ON public.injuries;
DROP POLICY IF EXISTS "Allow authenticated users to insert injuries" ON public.injuries;
DROP POLICY IF EXISTS "Allow authenticated users to update injuries" ON public.injuries;
DROP POLICY IF EXISTS "Allow authenticated users to delete injuries" ON public.injuries;

-- Crea policy SEMPLICI che permettono a tutti gli utenti autenticati di fare tutto
-- Questo risolve il problema di accesso agli infortuni

-- Policy per SELECT (visualizzare)
CREATE POLICY "Allow authenticated users to view injuries" ON public.injuries
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Policy per INSERT (creare)
CREATE POLICY "Allow authenticated users to insert injuries" ON public.injuries
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per UPDATE (modificare)
CREATE POLICY "Allow authenticated users to update injuries" ON public.injuries
    FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policy per DELETE (eliminare)
CREATE POLICY "Allow authenticated users to delete injuries" ON public.injuries
    FOR DELETE USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FINE SCRIPT
-- =====================================================