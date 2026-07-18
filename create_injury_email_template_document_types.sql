-- Associazione template email ↔ tipi di documento da allegare quando si invia l'email
-- I tipi sono filtrati per destinatario (assicurazione/csen/atleta) nella UI
CREATE TABLE IF NOT EXISTS injury_email_template_document_types (
  template_id UUID NOT NULL REFERENCES injury_email_templates(id) ON DELETE CASCADE,
  document_type_id UUID NOT NULL REFERENCES injury_document_types(id) ON DELETE CASCADE,
  PRIMARY KEY (template_id, document_type_id)
);

CREATE INDEX IF NOT EXISTS idx_injury_email_tpl_doc_tpl ON injury_email_template_document_types(template_id);
COMMENT ON TABLE injury_email_template_document_types IS 'Tipi di documento da allegare quando si invia l''email con questo template';

ALTER TABLE injury_email_template_document_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated manage injury_email_template_document_types" ON injury_email_template_document_types;
CREATE POLICY "Authenticated manage injury_email_template_document_types" ON injury_email_template_document_types
  FOR ALL USING (auth.role() = 'authenticated');
