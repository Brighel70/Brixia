-- =============================================================================
-- LOGO SOCIETÀ DI RUGBY - USA IL BUCKET "brand" GIÀ ESISTENTE
-- =============================================================================
-- I loghi vengono salvati in: brand/origin-clubs/{id-società}.png
--
-- Se hai già eseguito setup_logo_app_mobile.sql non serve altro per lo Storage.
-- Esegui solo add_origin_club_logo.sql per la colonna logo_url su origin_clubs.
-- =============================================================================

COMMENT ON COLUMN origin_clubs.logo_url IS 'URL pubblico del logo (bucket brand, cartella origin-clubs/)';
