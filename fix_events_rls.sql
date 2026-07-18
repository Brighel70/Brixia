-- Fix RLS policies for events table to allow authenticated users to create, read, update, and delete events

-- Drop existing RLS policies on events table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Events are insertable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are updatable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are deletable by authenticated users" ON public.events;

-- Create new permissive RLS policies for events table
CREATE POLICY "Enable read access for all users" ON public.events
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.events
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.events
    FOR DELETE USING (auth.role() = 'authenticated');

-- Verify RLS is enabled on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Test query to verify policies work
-- SELECT * FROM public.events LIMIT 1;








