-- DEPRECATED: usare people. Fix FK notes.person_id: deve puntare a people, non people3
-- L'app usa people come tabella anagrafica; people3 è legacy.
-- Errore 409: person_id (da people) non esiste in people3.
-- Esegui in Supabase SQL Editor.

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_person_id_fkey;

ALTER TABLE public.notes 
ADD CONSTRAINT notes_person_id_fkey 
FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
