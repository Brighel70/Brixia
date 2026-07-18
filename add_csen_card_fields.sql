-- Tessera CSEN: numero tessera (alfanumerico maiuscolo) e data emissione
ALTER TABLE people
ADD COLUMN IF NOT EXISTS csen_card TEXT,
ADD COLUMN IF NOT EXISTS csen_card_issued_at DATE;

COMMENT ON COLUMN people.csen_card IS 'Numero tessera CSEN (alfanumerico, memorizzato in maiuscolo)';
COMMENT ON COLUMN people.csen_card_issued_at IS 'Data di emissione della tessera CSEN';
