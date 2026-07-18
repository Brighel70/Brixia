-- Tabella per impostazioni brand condivise (es. URL logo app mobile FlowMe).
-- La webapp scrive qui quando salvi il logo da Personalizzazione Brand;
-- l'app mobile FlowMe legge il valore per mostrare il logo nell'header.

CREATE TABLE IF NOT EXISTS public.brand_settings (
  key text NOT NULL PRIMARY KEY,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS: abilita lettura per tutti (anon + authenticated) così l'app mobile può leggere senza auth
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read brand_settings"
  ON public.brand_settings FOR SELECT
  USING (true);

-- Solo utenti autenticati possono inserire/aggiornare (la webapp è autenticata)
CREATE POLICY "Allow authenticated insert update brand_settings"
  ON public.brand_settings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update brand_settings"
  ON public.brand_settings FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Commento
COMMENT ON TABLE public.brand_settings IS 'Impostazioni brand (es. mobile_app_logo_url) condivise tra webapp e app FlowMe';
