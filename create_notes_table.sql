-- Script per creare la tabella notes
-- Esegui questo script nel tuo database Supabase

-- ========================================
-- CREAZIONE TABELLA NOTES
-- ========================================

-- Crea la tabella notes
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'note',
  created_by text NOT NULL DEFAULT 'Sistema',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE
);

-- Crea indice per performance
CREATE INDEX IF NOT EXISTS idx_notes_person_id ON public.notes(person_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at);

-- Abilita RLS (Row Level Security)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Crea politica per le note (lettura/scrittura per staff autenticato)
CREATE POLICY "Note gestibili da staff autenticato" ON public.notes
  FOR ALL USING (auth.role() = 'authenticated');

-- Commenti per documentazione
COMMENT ON TABLE public.notes IS 'Note e commenti associati alle persone';
COMMENT ON COLUMN public.notes.person_id IS 'ID della persona di riferimento (tabella people)';
COMMENT ON COLUMN public.notes.content IS 'Contenuto della nota';
COMMENT ON COLUMN public.notes.type IS 'Tipo di nota (note, medical, etc.)';
COMMENT ON COLUMN public.notes.created_by IS 'Autore della nota';

-- Verifica la creazione della tabella
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;
