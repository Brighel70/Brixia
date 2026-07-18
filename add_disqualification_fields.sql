-- Aggiunge i campi per la squalifica dei giocatori
ALTER TABLE people
ADD COLUMN IF NOT EXISTS disqualified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS disqualification_end_date DATE;

-- Aggiunge commenti alle colonne
COMMENT ON COLUMN people.disqualified IS 'Indica se il giocatore è attualmente squalificato';
COMMENT ON COLUMN people.disqualification_end_date IS 'Data di scadenza della squalifica (obbligatoria se disqualified = true)';

-- Aggiunge un constraint per assicurarsi che se disqualified = true, allora disqualification_end_date non può essere NULL
ALTER TABLE people
ADD CONSTRAINT check_disqualification_date 
CHECK (
  (disqualified = false) OR 
  (disqualified = true AND disqualification_end_date IS NOT NULL)
);











