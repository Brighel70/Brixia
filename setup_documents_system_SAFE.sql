-- =====================================================
-- SETUP SISTEMA DOCUMENTI - Brixia Rugby (VERSIONE SICURA)
-- =====================================================
-- Esegui questo script nel SQL Editor di Supabase
-- Questo script è SICURO e non crea conflitti con policies esistenti

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

DROP TRIGGER IF EXISTS trigger_documents_updated_at ON public.documents;
CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- =====================================================
-- 2. ROW LEVEL SECURITY (RLS) - TABELLA DOCUMENTS
-- =====================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Elimina policies esistenti con lo stesso nome (se esistono)
DROP POLICY IF EXISTS "Staff can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Staff can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Staff can update documents" ON public.documents;
DROP POLICY IF EXISTS "Staff can delete documents" ON public.documents;

-- Policy: Staff autenticati possono vedere tutti i documenti
CREATE POLICY "Staff can view all documents" ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
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

-- Questo comando è SICURO: usa ON CONFLICT DO NOTHING
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs', 'docs', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. VERIFICA POLICIES STORAGE ESISTENTI
-- =====================================================

-- Mostra le policies storage esistenti
SELECT 
  '📋 POLICIES STORAGE ESISTENTI' as info,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%can%file%'
ORDER BY policyname;

-- =====================================================
-- 5. VERIFICA CONFIGURAZIONE FINALE
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

-- Verifica policies documents (tabella)
SELECT 'Policies tabella documents:' as check_type,
       COUNT(*)::text || ' policies attive' as status
FROM pg_policies 
WHERE tablename = 'documents' AND schemaname = 'public';

-- Verifica policies storage
SELECT 'Policies storage bucket:' as check_type,
       COUNT(*)::text || ' policies attive' as status
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- Mostra le policies sulla tabella documents
SELECT 
  '📋 POLICIES TABELLA DOCUMENTS' as info,
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'documents'
ORDER BY policyname;

SELECT '✅ Setup database completato!' as message;
SELECT '⚠️  NOTA: Le policies storage NON sono state modificate' as message;
SELECT '📋 Se il bucket docs esiste già con policies, tutto funzionerà correttamente' as message;
SELECT '🎉 Ora puoi caricare documenti dall''interfaccia!' as message;

-- =====================================================
-- 6. ISTRUZIONI FINALI
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ SETUP COMPLETATO CON SUCCESSO!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Cosa è stato creato:';
  RAISE NOTICE '  ✅ Tabella public.documents';
  RAISE NOTICE '  ✅ Indici per performance';
  RAISE NOTICE '  ✅ Trigger per updated_at';
  RAISE NOTICE '  ✅ 4 Policies RLS su tabella documents';
  RAISE NOTICE '  ✅ Bucket storage docs (se non esisteva)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '  - Le policies STORAGE sono state IGNORATE';
  RAISE NOTICE '  - Se hai già policies storage, continueranno a funzionare';
  RAISE NOTICE '  - Se NON hai policies storage, devi aggiungerle manualmente';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 PROSSIMI PASSI:';
  RAISE NOTICE '  1. Verifica che il bucket docs esista (Storage tab)';
  RAISE NOTICE '  2. Controlla le policies storage esistenti';
  RAISE NOTICE '  3. Testa l''upload di un documento dall''interfaccia';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;


