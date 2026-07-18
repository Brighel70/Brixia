-- Esegui questo script nel SQL Editor di Supabase
-- per correggere la foreign key tutor_athlete_relations

-- 1. Rimuovi la foreign key esistente che punta a tutors
ALTER TABLE public.tutor_athlete_relations 
DROP CONSTRAINT IF EXISTS tutor_athlete_relations_tutor_id_fkey;

-- 2. Aggiungi la nuova foreign key che punta a people
ALTER TABLE public.tutor_athlete_relations 
ADD CONSTRAINT tutor_athlete_relations_tutor_id_fkey 
FOREIGN KEY (tutor_id) REFERENCES public.people(id) ON DELETE CASCADE;













































vLRUOLO
