-- Vincitore opzionale per tornei / feste del rugby
ALTER TABLE events ADD COLUMN IF NOT EXISTS tournament_winner TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS expects_tournament_winner BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.tournament_winner IS 'Nome squadra vincitrice';
COMMENT ON COLUMN events.expects_tournament_winner IS 'Se true, in panoramica evento è prevista la registrazione del vincitore';

-- Abilita il flag sui tipi evento multi-squadra (modificabile da Impostazioni → Tipi evento)
UPDATE event_types
SET form_fields = form_fields || '{"allowsTournamentWinner": true}'::jsonb
WHERE code IN ('torneo', 'festa_del_rugby');
