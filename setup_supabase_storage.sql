-- Configurazione Supabase Storage per l'upload dei PDF
-- Esegui questi comandi nel SQL Editor di Supabase

-- 1. Crea il bucket 'docs' se non esiste
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs', 'docs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy per permettere agli utenti autenticati di leggere i propri file
CREATE POLICY "Users can read own files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Policy per permettere agli utenti autenticati di caricare file
CREATE POLICY "Users can upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Policy per permettere agli utenti autenticati di aggiornare i propri file
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Policy per permettere agli utenti autenticati di eliminare i propri file
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 6. Policy per permettere agli admin di accedere a tutti i file
CREATE POLICY "Admins can read all files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'docs' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can upload all files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'docs' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update all files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'docs' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete all files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'docs' AND 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Nota: Ricordati di configurare anche CORS nel pannello Storage di Supabase:
-- 1. Vai su Storage → Settings → CORS Configuration
-- 2. Aggiungi le seguenti configurazioni:
--    - Origin: image.pngimage.png000 (per sviluppo)
--    - Origin: https://your-vercel-domain.vercel.app (per produzione)
--    - Methods: GET, POST, PUT, PATCH, DELETE
--    - Headers: Authorization, Content-Type, Range








