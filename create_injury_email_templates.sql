-- Template email per destinatario (Assicurazione, Csen, Atleta). Il testo viene incollato nel corpo email in base al destinatario.
CREATE TABLE IF NOT EXISTS injury_email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  destinatario TEXT NOT NULL CHECK (destinatario IN ('assicurazione', 'csen', 'atleta')),
  body TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injury_email_templates_destinatario ON injury_email_templates(destinatario);
COMMENT ON TABLE injury_email_templates IS 'Template di testo per il corpo email, in base al destinatario (Assicurazione, Csen, Atleta)';

ALTER TABLE injury_email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage injury_email_templates" ON injury_email_templates;
CREATE POLICY "Authenticated manage injury_email_templates" ON injury_email_templates
  FOR ALL USING (auth.role() = 'authenticated');
