-- Logo società di rugby (URL pubblico su Supabase Storage)
ALTER TABLE origin_clubs
ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN origin_clubs.logo_url IS 'URL pubblico del logo (bucket brand, cartella origin-clubs/)';
