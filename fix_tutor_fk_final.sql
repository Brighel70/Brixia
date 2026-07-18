-- Script per correggere la foreign key tutor_athlete_relations
-- La foreign key deve puntare a people(id) invece che a tutors(id)

-- 1. Rimuovi la foreign key esistente che punta a tutors
ALTER TABLE public.tutor_athlete_relations 
DROP CONSTRAINT IF EXISTS tutor_athlete_relations_tutor_id_fkey;

-- 2. Aggiungi la nuova foreign key che punta a people
ALTER TABLE public.tutor_athlete_relations 
ADD CONSTRAINT tutor_athlete_relations_tutor_id_fkey 
FOREIGN KEY (tutor_id) REFERENCES public.people(id) ON DELETE CASCADE;

-- 3. Verifica che la foreign key sia stata creata correttamente
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
  AND tc.table_name='tutor_athlete_relations'
  AND kcu.column_name='tutor_id';


