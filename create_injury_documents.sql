-- Tabella documenti per infortunio (da inviare a CSEN, assicurazione, ecc.)
CREATE TABLE IF NOT EXISTS injury_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  injury_id UUID NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'altro' CHECK (category IN ('csen', 'assicurazione', 'altro')),
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_injury_documents_injury_id ON injury_documents(injury_id);
COMMENT ON TABLE injury_documents IS 'Documenti caricati per un infortunio, da inviare a CSEN/assicurazione';

-- RLS
ALTER TABLE injury_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage injury_documents" ON injury_documents
  FOR ALL USING (auth.role() = 'authenticated');

-- Storage bucket per documenti infortuni (cartella: injury-docs/{injury_id}/{filename})
-- NOTA: file_size_limit = limite PER SINGOLO FILE (in byte), NON il totale della cartella.
-- La cartella può contenere quanti documenti vuoi; lo spazio totale dipende dal piano Supabase.
-- 52428800 = 50 MB per file (per PDF/scansioni pesanti).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'injury-docs',
  'injury-docs',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: utenti autenticati possono leggere/caricare/eliminare in injury-docs
CREATE POLICY "Authenticated read injury-docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'injury-docs');

CREATE POLICY "Authenticated insert injury-docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'injury-docs');

CREATE POLICY "Authenticated update injury-docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'injury-docs');

CREATE POLICY "Authenticated delete injury-docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'injury-docs');
