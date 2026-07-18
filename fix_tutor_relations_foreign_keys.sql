-- Fix foreign keys for tutor_athlete_relations table
-- This script ensures Supabase can recognize the relationships

-- 1. Remove existing foreign key constraints
ALTER TABLE public.tutor_athlete_relations 
DROP CONSTRAINT IF EXISTS tutor_athlete_relations_tutor_id_fkey;

ALTER TABLE public.tutor_athlete_relations 
DROP CONSTRAINT IF EXISTS tutor_athlete_relations_athlete_id_fkey;

-- 2. Add foreign key for tutor_id -> people(id)
ALTER TABLE public.tutor_athlete_relations 
ADD CONSTRAINT tutor_athlete_relations_tutor_id_fkey 
FOREIGN KEY (tutor_id) REFERENCES public.people(id) ON DELETE CASCADE;

-- 3. Add foreign key for athlete_id -> people(id)
ALTER TABLE public.tutor_athlete_relations 
ADD CONSTRAINT tutor_athlete_relations_athlete_id_fkey 
FOREIGN KEY (athlete_id) REFERENCES public.people(id) ON DELETE CASCADE;

-- 4. Verify the foreign keys were created correctly
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'tutor_athlete_relations'
ORDER BY kcu.column_name;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tutor_athlete_relations_tutor_id ON public.tutor_athlete_relations(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_athlete_relations_athlete_id ON public.tutor_athlete_relations(athlete_id);

-- 6. Refresh the schema cache (this helps Supabase recognize the relationships)
-- Note: This might need to be done manually in Supabase dashboard or via API








