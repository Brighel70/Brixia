-- =============================================================================
-- FIX: policy Storage per il logo app mobile (bucket "brand")
-- =============================================================================
-- PRIMA: Supabase Dashboard > Storage > New bucket > Nome: brand, Public: SÌ
-- Poi esegui questo script. Dalla webapp: Personalizzazione Brand → Logo app mobile → Salva.
-- =============================================================================

DROP POLICY IF EXISTS "Allow authenticated select brand bucket" ON storage.objects;
CREATE POLICY "Allow authenticated select brand bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand');

DROP POLICY IF EXISTS "Allow authenticated upload brand logo" ON storage.objects;
CREATE POLICY "Allow authenticated upload brand logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand');

DROP POLICY IF EXISTS "Allow authenticated update brand logo" ON storage.objects;
CREATE POLICY "Allow authenticated update brand logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'brand')
WITH CHECK (bucket_id = 'brand');

DROP POLICY IF EXISTS "Allow authenticated delete brand logo" ON storage.objects;
CREATE POLICY "Allow authenticated delete brand logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'brand');
