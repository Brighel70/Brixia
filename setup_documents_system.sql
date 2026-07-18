-- =====================================================
-- SETUP SISTEMA DOCUMENTI - Brixia Rugby
-- =====================================================
-- Esegui questo script nel SQL Editor di Supabase

-- =====================================================
-- 1. CREA TABELLA DOCUMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL, -- 'id_card','certificate','receipt','consent','other'
  file_path text NOT NULL, -- path nel bucket 'docs'
  file_size integer,
  file_type text,
  visibility text NOT NULL DEFAULT 'staff' CHECK (visibility IN ('private_admin','staff','owner_only','owner_guardians')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_documents_person_id ON public.documents(person_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- =====================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Policy: Staff autenticati possono vedere tutti i documenti
CREATE POLICY "Staff can view all documents" ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('Admin', 'Dirigente', 'Segreteria', 'Direttore Sportivo')
    )
  );

-- Policy: Staff autenticati possono inserire documenti
CREATE POLICY "Staff can insert documents" ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Policy: Staff autenticati possono aggiornare documenti
CREATE POLICY "Staff can update documents" ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Policy: Staff autenticati possono eliminare documenti
CREATE POLICY "Staff can delete documents" ON public.documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- =====================================================
-- 3. CREA BUCKET STORAGE 'docs' (se non esiste)
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('docs', 'docs', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. POLICIES PER STORAGE BUCKET 'docs'
-- =====================================================

-- Policy: Staff autenticati possono leggere file
CREATE POLICY "Staff can read files" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Policy: Staff autenticati possono caricare file
CREATE POLICY "Staff can upload files" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Policy: Staff autenticati possono aggiornare file
CREATE POLICY "Staff can update files" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- Policy: Staff autenticati possono eliminare file
CREATE POLICY "Staff can delete files" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'docs' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- =====================================================
-- 5. VERIFICA CONFIGURAZIONE
-- =====================================================

-- Verifica tabella documents
SELECT 'Tabella documents:' as check_type, 
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.tables 
         WHERE table_schema = 'public' AND table_name = 'documents'
       ) THEN '✅ Esiste' ELSE '❌ Non trovata' END as status;

-- Verifica bucket docs
SELECT 'Bucket docs:' as check_type,
       CASE WHEN EXISTS (
         SELECT 1 FROM storage.buckets WHERE id = 'docs'
       ) THEN '✅ Esiste' ELSE '❌ Non trovato' END as status;

-- Verifica policies documents
SELECT 'Policies documents:' as check_type,
       COUNT(*)::text || ' policies attive' as status
FROM pg_policies 
WHERE tablename = 'documents';

-- Verifica policies storage
SELECT 'Policies storage:' as check_type,
       COUNT(*)::text || ' policies attive' as status
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

SELECT '✅ Setup completato!' as message;
SELECT '📋 Ora puoi caricare documenti dall''interfaccia' as message;


