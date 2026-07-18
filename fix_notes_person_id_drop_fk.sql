-- DEPRECATED: usare people. Script legacy per notes.person_id.
-- Rimuove la FK notes.person_id per permettere l'insert.
-- L'ID person_id esiste in people3 ma non in people; il vincolo blocca l'inserimento.
-- Esegui in Supabase SQL Editor.

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_person_id_fkey;
