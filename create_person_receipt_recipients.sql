
-- Permessi (RLS): gli utenti autenticati dell'app possono leggere, inserire e cancellare
ALTER TABLE person_receipt_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "person_receipt_recipients_select" ON person_receipt_recipients;
CREATE POLICY "person_receipt_recipients_select" ON person_receipt_recipients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "person_receipt_recipients_insert" ON person_receipt_recipients;
CREATE POLICY "person_rece-- Destinatari ricevute di pagamento: per ogni giocatore, le persone (tutor/familiari) a cui inviare le ricevute
CREATE TABLE IF NOT EXISTS person_receipt_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  recipient_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(person_id, recipient_person_id)
);

CREATE INDEX IF NOT EXISTS idx_person_receipt_recipients_person ON person_receipt_recipients(person_id);
CREATE INDEX IF NOT EXISTS idx_person_receipt_recipients_recipient ON person_receipt_recipients(recipient_person_id);

COMMENT ON TABLE person_receipt_recipients IS 'Persone (tutor/familiari) a cui inviare le ricevute di pagamento per ogni giocatore';
ipt_recipients_insert" ON person_receipt_recipients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "person_receipt_recipients_delete" ON person_receipt_recipients;
CREATE POLICY "person_receipt_recipients_delete" ON person_receipt_recipients FOR DELETE TO authenticated USING (true);
