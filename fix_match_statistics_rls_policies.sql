-- =====================================================
-- SCRIPT PER CORREGGERE LE POLICY RLS DI match_statistics
-- =====================================================
-- Questo script elimina e ricrea le policy con la sintassi corretta per JSONB

-- Elimina le policy esistenti se ci sono
DROP POLICY IF EXISTS "Users can view match statistics for their categories" ON public.match_statistics;
DROP POLICY IF EXISTS "Users can insert match statistics for their categories" ON public.match_statistics;
DROP POLICY IF EXISTS "Users can update match statistics for their categories" ON public.match_statistics;
DROP POLICY IF EXISTS "Users can delete match statistics for their categories" ON public.match_statistics;

-- Ricrea le policy con la sintassi corretta per JSONB
CREATE POLICY "Users can view match statistics for their categories" ON public.match_statistics
    FOR SELECT USING (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

CREATE POLICY "Users can insert match statistics for their categories" ON public.match_statistics
    FOR INSERT WITH CHECK (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

CREATE POLICY "Users can update match statistics for their categories" ON public.match_statistics
    FOR UPDATE USING (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

CREATE POLICY "Users can delete match statistics for their categories" ON public.match_statistics
    FOR DELETE USING (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

-- =====================================================
-- FINE SCRIPT
-- =====================================================
