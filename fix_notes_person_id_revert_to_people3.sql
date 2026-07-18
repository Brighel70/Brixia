-- ❌ DO NOT RUN: reverts migration back to people3
-- ═══════════════════════════════════════════════════════════════════════════════
-- Questo script ripristina la FK notes.person_id su people3 (DEPRECATA).
-- NON eseguire: rompe l'app che usa people. Mantenere FK su people.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Ripristina FK notes.person_id su people3
-- Se person_id non esiste in people ma esiste in people3, usa people3.
-- Esegui in Supabase SQL Editor.

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_person_id_fkey;

ALTER TABLE public.notes 
ADD CONSTRAINT notes_person_id_fkey 
FOREIGN KEY (person_id) REFERENCES public.people3(id) ON DELETE CASCADE;
