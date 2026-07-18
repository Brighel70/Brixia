-- Tabella per gestire le relazioni giocatore-familiare (Many-to-Many)
CREATE TABLE IF NOT EXISTS player_guardian_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  guardian_person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('padre', 'madre', 'nonno', 'nonna', 'zio', 'zia', 'tutore')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_person_id, guardian_person_id)
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_player_guardian_player ON player_guardian_relationships(player_person_id);
CREATE INDEX IF NOT EXISTS idx_player_guardian_guardian ON player_guardian_relationships(guardian_person_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_player_guardian_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_player_guardian_relationships_updated_at ON player_guardian_relationships;
CREATE TRIGGER trigger_update_player_guardian_relationships_updated_at
  BEFORE UPDATE ON player_guardian_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_player_guardian_relationships_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE player_guardian_relationships IS 'Relazioni many-to-many tra giocatori e familiari';
COMMENT ON COLUMN player_guardian_relationships.player_person_id IS 'ID del giocatore (persona con is_player=true)';
COMMENT ON COLUMN player_guardian_relationships.guardian_person_id IS 'ID del familiare (persona con ruolo familiare)';
COMMENT ON COLUMN player_guardian_relationships.relationship_type IS 'Tipo di parentela: padre, madre, nonno, nonna, zio, zia, tutore';








