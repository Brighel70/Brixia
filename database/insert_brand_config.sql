-- =============================================================================
-- Inserisce/aggiorna la configurazione brand per FlowMe (tabella brand_settings).
-- Eseguire in Supabase: SQL Editor → incolla → Run.
-- =============================================================================
-- Dopo l'esecuzione, FlowMe leggerà il brand da qui all'avvio.
-- Per usare un logo dal bucket Storage "brand": carica il file in Storage → brand,
-- poi sostituisci l'URL sotto in "logo" (es. https://TUO_PROJECT.supabase.co/storage/v1/object/public/brand/logo.png).
-- =============================================================================

INSERT INTO public.brand_settings (key, value, updated_at)
VALUES (
  'brand_config',
  '{
    "clubName": "Brixia Rugby",
    "clubShortName": "Brixia",
    "clubDescription": "Società Sportiva Dilettantistica",
    "colors": {
      "primary": "#0b1f4d",
      "secondary": "#4aa3ff",
      "accent": "#f7f7f5",
      "success": "#10b981",
      "warning": "#f59e0b",
      "danger": "#ef4444",
      "info": "#3b82f6",
      "light": "#f8fafc",
      "dark": "#1e293b"
    },
    "contact": {
      "email": "info@brixiarugby.it",
      "phone": "+39 030 1234567",
      "address": "Via del Rugby, 123 - Brescia",
      "website": "www.brixiarugby.it"
    },
    "season": "2025/26",
    "assets": {
      "logo": "/logo bianco e celeste.png",
      "logoAlt": "Logo Brixia Rugby",
      "favicon": "/favicon.ico"
    }
  }'::text,
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();
