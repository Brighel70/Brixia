-- ============================================================
-- STORAGE RICEVUTE: bucket + permessi di lettura
-- Esegui questo script nel SQL Editor di Supabase (dopo create_payment_receipts.sql).
-- ============================================================

-- 1) Crea il bucket "ricevute" (se non esiste già)
--    file_size_limit = 52428800 = 50 MB (i PDF con logo/immagini possono essere grandi)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ricevute',
  'ricevute',
  true,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- 2) Permesso: chiunque può LEGGERE (aprire) i PDF delle ricevute
--    così il link funziona anche da telefono/email senza login
DROP POLICY IF EXISTS "Lettura pubblica ricevute" ON storage.objects;
CREATE POLICY "Lettura pubblica ricevute"
ON storage.objects FOR SELECT
USING (bucket_id = 'ricevute');

-- 3) Permesso: solo utenti autenticati dell'app possono CARICARE
--    (TeamFlow quando genera la ricevuta)
DROP POLICY IF EXISTS "Solo autenticati possono caricare ricevute" ON storage.objects;
CREATE POLICY "Solo autenticati possono caricare ricevute"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ricevute');

-- Aggiorna (sovrascrivi) una ricevuta già esistente
DROP POLICY IF EXISTS "Solo autenticati possono aggiornare ricevute" ON storage.objects;
CREATE POLICY "Solo autenticati possono aggiornare ricevute"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'ricevute');
