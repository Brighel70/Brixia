-- Ricevute di pagamento generate e caricate per i destinatari (tutor/familiari)
-- FlowMe mostra l'icona documento nella sezione Pagamenti quando esiste una riga per quel fee_assignment e quel recipient
CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_assignment_id UUID NOT NULL REFERENCES fee_assignments(id) ON DELETE CASCADE,
  recipient_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  pdf_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fee_assignment_id, recipient_person_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_assignment ON payment_receipts(fee_assignment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_recipient ON payment_receipts(recipient_person_id);

COMMENT ON TABLE payment_receipts IS 'PDF ricevute di pagamento caricati per visualizzazione in FlowMe (sezione Pagamenti)';

-- Dopo questo script, esegui anche: setup_storage_ricevute.sql
-- Istruzioni complete (passo passo): apri ISTRUZIONI_RICEVUTE_SUPABASE.md
