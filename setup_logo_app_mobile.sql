-- =============================================================================
-- SETUP LOGO APP MOBILE (FlowMe) - ESEGUI IN SUPABASE (SQL EDITOR)
-- =============================================================================
-- PRIMA: in Supabase Dashboard > Storage > New bucket >
--   Nome: brand
--   Public bucket: SÌ (abilita accesso pubblico)
-- Poi esegui questo script. Infine dalla webapp carica il logo e clicca Salva.
-- =============================================================================

-- 1) Tabella per l'URL del logo
CREATE TABLE IF NOT EXISTS public.brand_settings (
  key text NOT NULL PRIMARY KEY,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read brand_settings" ON public.brand_settings;
CREATE POLICY "Allow read brand_settings"
  ON public.brand_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert update brand_settings" ON public.brand_settings;
CREATE POLICY "Allow authenticated insert update brand_settings"
  ON public.brand_settings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated update brand_settings" ON public.brand_settings;
CREATE POLICY "Allow authenticated update brand_settings"
  ON public.brand_settings FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2) Storage bucket "brand": la webapp (autenticata) può leggere/caricare/aggiornare/eliminare file
--    (Crea prima il bucket in Dashboard: Storage > New bucket > Nome: brand, Public: SÌ)
DROP POLICY IF EXISTS "Allow authenticated select brand bucket" ON storage.objects;
CREATE POLICY "Allow authenticated select brand bucket"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand');

DROP POLICY IF EXISTS "Allow authenticated upload brand logo" ON storage.objects;
CREATE POLICY "Allow authenticated upload brand logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand');

DROP POLICY IF EXISTS "Allow authenticated update brand logo" ON storage.objects;
CREATE POLICY "Allow authenticated update brand logo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'brand')
WITH CHECK (bucket_id = 'brand');

DROP POLICY IF EXISTS "Allow authenticated delete brand logo" ON storage.objects;
CREATE POLICY "Allow authenticated delete brand logo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brand');
