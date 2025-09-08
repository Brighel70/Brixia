-- STEP F: Documenti (Storage + indice DB)
-- Migrazione sicura per Supabase - Non elimina nulla esistente

-- Tabella indice
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL, -- es. 'id_card','certificate','receipt','other'
  file_path text NOT NULL, -- path su bucket 'documents'
  visibility text NOT NULL CHECK (visibility IN ('private_admin','staff','owner_only','owner_guardians')),
  created_by uuid REFERENCES public.people(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- (Da UI/Storage: usa bucket privato 'documents' con path: documents/people/{person_id}/...)





