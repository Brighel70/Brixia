-- Aggiunge la colonna "società di origine" alla tabella people
-- (dove ha giocato il giocatore prima di entrare in under 14 nel Brixia)
ALTER TABLE people
ADD COLUMN IF NOT EXISTS origin_club text;

COMMENT ON COLUMN people.origin_club IS 'Società di origine: dove ha giocato prima di entrare in Under 14 nel Brixia';
