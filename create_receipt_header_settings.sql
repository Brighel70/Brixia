-- Dati intestazione ricevuta (carta intestata): nome, sede, CF, P.IVA, FIR, luogo
-- Un'unica riga di configurazione usata dai template PDF
CREATE TABLE IF NOT EXISTS receipt_header_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_associazione TEXT,
  sede_legale TEXT,
  cf_associazione TEXT,
  piva_associazione TEXT,
  affiliazione_fir TEXT,
  luogo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vincolo: una sola riga (singleton)
CREATE UNIQUE INDEX IF NOT EXISTS receipt_header_settings_singleton ON receipt_header_settings ((true));

-- Inserisci riga iniziale se non esiste
INSERT INTO receipt_header_settings (nome_associazione, sede_legale, cf_associazione, piva_associazione, affiliazione_fir, luogo)
SELECT '', '', '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM receipt_header_settings LIMIT 1);

COMMENT ON TABLE receipt_header_settings IS 'Dati per intestazione/carta intestata delle ricevute PDF (Template Ricevute in Impostazioni)';

ALTER TABLE receipt_header_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipt_header_select" ON receipt_header_settings;
CREATE POLICY "receipt_header_select" ON receipt_header_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "receipt_header_update" ON receipt_header_settings;
CREATE POLICY "receipt_header_update" ON receipt_header_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "receipt_header_insert" ON receipt_header_settings;
CREATE POLICY "receipt_header_insert" ON receipt_header_settings FOR INSERT TO authenticated WITH CHECK (true);
