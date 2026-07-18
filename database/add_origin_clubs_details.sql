-- Dettagli società di rugby: nazionalità, regione, responsabili
ALTER TABLE origin_clubs
ADD COLUMN IF NOT EXISTS is_italian boolean NOT NULL DEFAULT true;

ALTER TABLE origin_clubs
ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE origin_clubs
ADD COLUMN IF NOT EXISTS contacts jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN origin_clubs.is_italian IS 'True se la società è italiana';
COMMENT ON COLUMN origin_clubs.region IS 'Regione italiana (se is_italian = true)';
COMMENT ON COLUMN origin_clubs.contacts IS 'Array JSON di responsabili: [{name, role, phone?, email?}]';
