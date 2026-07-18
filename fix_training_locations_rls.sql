-- Fix RLS policies for training_locations table

-- 1. Drop existing RLS policies if they exist
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

-- 3. Verify that RLS is enabled
ALTER TABLE public.training_locations ENABLE ROW LEVEL SECURITY;

-- 4. Check if the table exists and has the correct structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'training_locations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;








