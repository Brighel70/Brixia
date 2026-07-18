-- Aggiungi campi specifici del tutor alla tabella people
ALTER TABLE people 
ADD COLUMN IF NOT EXISTS profession TEXT,
ADD COLUMN IF NOT EXISTS professional_category TEXT,
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS primary_contact BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS possible_sponsor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS useful_to_club BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tutor_notes TEXT;

-- Aggiungi commenti per documentare i campi
COMMENT ON COLUMN people.profession IS 'Professione del tutor';
COMMENT ON COLUMN people.professional_category IS 'Categoria professionale del tutor';
COMMENT ON COLUMN people.company IS 'Azienda del tutor';
COMMENT ON COLUMN people.position IS 'Posizione/Ruolo del tutor';
COMMENT ON COLUMN people.primary_contact IS 'Se il tutor è il contatto principale';
COMMENT ON COLUMN people.possible_sponsor IS 'Se il tutor può essere uno sponsor';
COMMENT ON COLUMN people.useful_to_club IS 'Se il tutor è utile al club';
COMMENT ON COLUMN people.tutor_notes IS 'Note aggiuntive sul tutor';











