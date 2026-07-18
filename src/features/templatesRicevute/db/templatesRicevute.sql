-- Tabella template documenti (ricevute)
-- Eseguire su Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.templates_documenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  contenuto_html text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_templates_documenti()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS templates_documenti_updated_at ON public.templates_documenti;
CREATE TRIGGER templates_documenti_updated_at
  BEFORE UPDATE ON public.templates_documenti
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at_templates_documenti();

-- Seed: 2 record default (UPSERT per idempotenza)
-- Il contenuto completo dei default è gestito dall'app in defaultTemplates.ts; qui inseriamo un placeholder.
-- L'app alla prima apertura può usare i default da codice; "Ripristina Default" sovrascrive con defaultTemplates.
INSERT INTO public.templates_documenti (nome, contenuto_html)
VALUES
  ('ricevuta_soluzione_unica', '<div style="font-family: Inter, Arial, sans-serif; font-size: 12px;">RICEVUTA DI PAGAMENTO N. {{numero_ricevuta}}/{{anno}} – Template Soluzione Unica. Usare "Ripristina Default" per caricare il testo ufficiale.</div>'),
  ('ricevuta_rateizzata', '<div style="font-family: Inter, Arial, sans-serif; font-size: 12px;">RICEVUTA DI PAGAMENTO PARZIALE N. {{numero_ricevuta}}/{{anno}} – Template Rateizzata. Usare "Ripristina Default" per caricare il testo ufficiale.</div>')
ON CONFLICT (nome) DO UPDATE SET
  updated_at = now();

-- Commento: dopo la prima esecuzione, dalla UI "Ripristina Default" caricherà il contenuto completo da defaultTemplates.ts.
