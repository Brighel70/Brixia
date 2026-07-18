-- Rende leggibili pubblicamente i file nella cartella "brand" del bucket "docs"
-- (necessario per il logo app mobile: l'app FlowMe deve poter caricare l'immagine senza login).
-- Esegui questo script nel SQL Editor di Supabase se il logo nell'app mobile non si vede.

DROP POLICY IF EXISTS "Allow public read brand folder" ON storage.objects;

CREATE POLICY "Allow public read brand folder"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'docs'
  AND (name = 'brand/mobile-app-logo.png' OR name = 'brand/mobile-app-logo.svg')
);
