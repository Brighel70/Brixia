-- Aggiunge la colonna gironi alla tabella events (tornei).
-- Struttura: array di { id, name, teams: string[] } in JSONB.

ALTER TABLE events
ADD COLUMN IF NOT EXISTS gironi jsonb DEFAULT NULL;

COMMENT ON COLUMN events.gironi IS 'Per eventi torneo: [{ "id": "uuid", "name": "Girone 1", "teams": ["Squadra A", "Squadra B"] }, ...]';
