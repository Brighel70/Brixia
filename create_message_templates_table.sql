-- Tabella per template di messaggi (WhatsApp, Email, Altro)
-- Permette di creare e gestire template riutilizzabili per invio messaggi

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('whatsapp', 'email', 'altro')),
  name text NOT NULL,
  content text NOT NULL,
  subject text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_type ON message_templates(type);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Lettura e scrittura per utenti autenticati
DROP POLICY IF EXISTS "Authenticated read message_templates" ON message_templates;
CREATE POLICY "Authenticated read message_templates"
  ON message_templates FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated insert message_templates" ON message_templates;
CREATE POLICY "Authenticated insert message_templates"
  ON message_templates FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update message_templates" ON message_templates;
CREATE POLICY "Authenticated update message_templates"
  ON message_templates FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete message_templates" ON message_templates;
CREATE POLICY "Authenticated delete message_templates"
  ON message_templates FOR DELETE
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE message_templates IS 'Template per messaggi WhatsApp, Email e altri canali';
