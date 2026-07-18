-- Tipi di documento caricabili per infortunio e destinatari (Assicurazione, Csen, Atleta)
-- Configurabili da Impostazioni > Infortuni/Assicurazione; usati nel tab Documentazione.

CREATE TABLE IF NOT EXISTS injury_document_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS injury_document_type_assignees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type_id UUID NOT NULL REFERENCES injury_document_types(id) ON DELETE CASCADE,
  assignee TEXT NOT NULL CHECK (assignee IN ('assicurazione', 'csen', 'atleta')),
  UNIQUE(document_type_id, assignee)
);

CREATE INDEX IF NOT EXISTS idx_injury_document_type_assignees_type ON injury_document_type_assignees(document_type_id);

COMMENT ON TABLE injury_document_types IS 'Tipi di documento (es. Certificato medico) collegati al primo campo nel tab Documentazione';
COMMENT ON TABLE injury_document_type_assignees IS 'Destinatari associati a ogni tipo: Assicurazione, Csen, Atleta (secondo campo)';

-- RLS
ALTER TABLE injury_document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE injury_document_type_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage injury_document_types" ON injury_document_types;
CREATE POLICY "Authenticated manage injury_document_types" ON injury_document_types
  FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated manage injury_document_type_assignees" ON injury_document_type_assignees;
CREATE POLICY "Authenticated manage injury_document_type_assignees" ON injury_document_type_assignees
  FOR ALL USING (auth.role() = 'authenticated');

-- Consenti destinatario "atleta" in injury_documents (oltre a csen, assicurazione, altro)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'injury_documents' AND constraint_name = 'injury_documents_category_check') THEN
    ALTER TABLE injury_documents DROP CONSTRAINT injury_documents_category_check;
  END IF;
  ALTER TABLE injury_documents ADD CONSTRAINT injury_documents_category_check
    CHECK (category IN ('csen', 'assicurazione', 'atleta', 'altro'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
