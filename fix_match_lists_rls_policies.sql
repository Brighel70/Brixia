-- =====================================================
-- SCRIPT PER CORREGGERE LE POLICY RLS DI match_lists
-- =====================================================
-- Questo script elimina e ricrea le policy con la sintassi corretta per JSONB

-- Elimina le policy esistenti se ci sono
DROP POLICY IF EXISTS "Users can view match lists for their categories" ON public.match_lists;
DROP POLICY IF EXISTS "Users can insert match lists for their categories" ON public.match_lists;

-- Ricrea le policy con la sintassi corretta per JSONB
CREATE POLICY "Users can view match lists for their categories" ON public.match_lists
    FOR SELECT USING (
        category_id IN (
            SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
            WHERE id = auth.uid() AND staff_categories IS NOT NULL
        )
    );

CREATE POLICY "Users can insert match lists for their categories" ON public.match_lists
    FOR INSERT WITH CHECK (
        category_id IN (
            SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
            WHERE id = auth.uid() AND staff_categories IS NOT NULL
        ) AND created_by = auth.uid()
    );

-- =====================================================
-- FINE SCRIPT
-- =====================================================
