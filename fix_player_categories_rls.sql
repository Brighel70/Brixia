-- Script per risolvere il problema RLS della tabella player_categories

-- 1. DISABILITA RLS sulla tabella player_categories
ALTER TABLE public.player_categories DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI TUTTE LE POLITICHE ESISTENTI (se ce ne sono)
DROP POLICY IF EXISTS "player_categories_select_policy" ON public.player_categories;
DROP POLICY IF EXISTS "player_categories_insert_policy" ON public.player_categories;
DROP POLICY IF EXISTS "player_categories_update_policy" ON public.player_categories;
DROP POLICY IF EXISTS "player_categories_delete_policy" ON public.player_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read player_categories" ON public.player_categories;
DROP POLICY IF EXISTS "Allow all users to read player_categories" ON public.player_categories;
DROP POLICY IF EXISTS "Allow authenticated users to insert player_categories" ON public.player_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update player_categories" ON public.player_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete player_categories" ON public.player_categories;

-- 3. VERIFICA CHE RLS SIA DISABILITATO
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'player_categories';

-- 4. TESTA L'ACCESSO ALLA TABELLA
SELECT 'Test accesso player_categories:' as info, COUNT(*) as total_records
FROM public.player_categories;



