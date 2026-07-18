-- Data fine per eventi "festa del club" (intervallo date invece di orario)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_end_date DATE;

COMMENT ON COLUMN events.event_end_date IS 'Data fine festa (tipi evento con isClubParty nel form_fields)';

-- Abilita "Festa del club" sul tipo festa già presente (se esiste)
UPDATE event_types
SET form_fields = form_fields || '{"isClubParty": true, "stripIcon": "FDC"}'::jsonb
WHERE code = 'festa' AND NOT COALESCE((form_fields->>'isClubParty')::boolean, false);
