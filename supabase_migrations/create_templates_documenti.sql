-- Tabella template documenti (ricevute PDF)
-- Eseguire in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.templates_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  contenuto_html text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_templates_documenti_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_documenti_updated_at ON public.templates_documenti;
CREATE TRIGGER templates_documenti_updated_at
  BEFORE UPDATE ON public.templates_documenti
  FOR EACH ROW EXECUTE PROCEDURE update_templates_documenti_updated_at();

-- Inserimento record default (contenuto minimo; l'app usa i default completi da codice per "Ripristina Default")
INSERT INTO public.templates_documenti (nome, contenuto_html)
VALUES 
  ('ricevuta_soluzione_unica', '<p>Template Ricevuta Soluzione Unica. Usa Ripristina Default per il contenuto completo.</p>'),
  ('ricevuta_rateizzata', '<p>Template Ricevuta Rateizzata. Usa Ripristina Default per il contenuto completo.</p>')
ON CONFLICT (nome) DO NOTHING;

-- RLS (opzionale: abilita se serve restrizione per ruolo)
ALTER TABLE public.templates_documenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read templates_documenti for authenticated"
  ON public.templates_documenti FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update templates_documenti for authenticated"
  ON public.templates_documenti FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert templates_documenti for authenticated"
  ON public.templates_documenti FOR INSERT TO authenticated WITH CHECK (true);
