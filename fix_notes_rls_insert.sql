-- Fix RLS su notes: errore 403 su INSERT
-- La policy esistente potrebbe non coprire correttamente INSERT.
-- Esegui in Supabase SQL Editor.

-- 1. Rimuovi tutte le policy esistenti su notes
DROP POLICY IF EXISTS "Note gestibili da staff autenticato" ON public.notes;
DROP POLICY IF EXISTS "notes_select_update_delete" ON public.notes;
DROP POLICY IF EXISTS "notes_select" ON public.notes;
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
DROP POLICY IF EXISTS "notes_update" ON public.notes;
DROP POLICY IF EXISTS "notes_delete" ON public.notes;

-- 2. Policy esplicite per ogni operazione (più affidabile per INSERT)
CREATE POLICY "notes_select" ON public.notes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "notes_insert" ON public.notes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notes_update" ON public.notes
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (auth.role() = 'authenticated');
