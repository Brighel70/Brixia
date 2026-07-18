-- FIX: Policy Storage per upload documenti persone (bucket docs)
-- Errore: "new row violates row-level security policy"
-- Causa: Le policy esistenti richiedevano path = auth.uid() ma l'app usa people/{person_id}/...
--
-- Esegui nel SQL Editor di Supabase

-- 1. Rimuovi tutte le policy esistenti sul bucket docs (potrebbero essere conflittuali)
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload all files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update all files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete all files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete files" ON storage.objects;

-- 2. Crea bucket docs se non esiste
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs', 'docs', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Nuove policy: utenti autenticati possono gestire file nel bucket docs
--    Path supportato: people/{person_id}/{filename}
CREATE POLICY "Authenticated can read docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'docs');

CREATE POLICY "Authenticated can upload docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'docs');

CREATE POLICY "Authenticated can update docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'docs')
WITH CHECK (bucket_id = 'docs');

CREATE POLICY "Authenticated can delete docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'docs');

-- Verifica
SELECT 'Policy storage docs configurate correttamente' as message;
