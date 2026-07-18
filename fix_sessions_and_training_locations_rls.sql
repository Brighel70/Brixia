-- Fix RLS policies for both sessions and training_locations tables

-- ==============================================
-- FIX TRAINING_LOCATIONS TABLE
-- ==============================================

-- 1. Drop existing RLS policies for training_locations
DROP POLICY IF EXISTS "Enable read access for all users" ON public.training_locations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.training_locations;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.training_locations;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.training_locations;

-- 2. Create new permissive RLS policies for training_locations
CREATE POLICY "Enable read access for all users" ON public.training_locations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.training_locations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.training_locations
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.training_locations
    FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Enable RLS for training_locations
ALTER TABLE public.training_locations ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- FIX SESSIONS TABLE
-- ==============================================

-- 1. Drop existing RLS policies for sessions
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sessions;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.sessions;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.sessions;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.sessions;

-- 2. Create new permissive RLS policies for sessions
CREATE POLICY "Enable read access for all users" ON public.sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.sessions
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.sessions
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.sessions
    FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Enable RLS for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- VERIFY TABLES STRUCTURE
-- ==============================================

-- Check training_locations structure
SELECT 
    'training_locations' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'training_locations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check sessions structure  
SELECT 
    'sessions' as table_name,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sessions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ==============================================
-- VERIFY POLICIES CREATED
-- ==============================================

-- Check training_locations policies
SELECT 
    'training_locations' as table_name,
    policyname, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'training_locations' 
  AND schemaname = 'public';

-- Check sessions policies
SELECT 
    'sessions' as table_name,
    policyname, 
    cmd, 
    qual, 
    with_check
FROM pg_policies 
WHERE tablename = 'sessions' 
  AND schemaname = 'public';








