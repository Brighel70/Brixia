-- Tipi evento calendario (menu "Tipo Evento", homepage sportiva, campi form)
-- Eseguire su Supabase prima di usare Impostazioni → Tipi evento

CREATE TABLE IF NOT EXISTS event_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_sporting BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  form_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_types_active_sort ON event_types(active, sort_order);

COMMENT ON TABLE event_types IS 'Tipi evento calendario: dropdown creazione evento, flag sportivo, campi form';
COMMENT ON COLUMN event_types.form_fields IS 'JSON: showCategory, showOpponent, showOpponents, showHomeAway, showChampionship, showParticipants, showInvited, showOrdineDelGiorno, showVerbalePdf, timeFieldType, listUsesColumns, requiresCategory, isClubParty, stripIcon';

INSERT INTO event_types (code, name, is_sporting, sort_order, form_fields) VALUES
  ('partita', 'Partita', true, 1, '{
    "showCategory": true, "showOpponent": true, "showOpponents": false, "showHomeAway": true,
    "showChampionship": true, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": true, "requiresCategory": false
  }'::jsonb),
  ('torneo', 'Torneo', true, 2, '{
    "showCategory": true, "showOpponent": false, "showOpponents": true, "showHomeAway": true,
    "showChampionship": true, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": true, "requiresCategory": false
  }'::jsonb),
  ('evento_sociale', 'Evento Sociale', false, 3, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false
  }'::jsonb),
  ('raduno', 'Raduno', false, 4, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false
  }'::jsonb),
  ('festa', 'Festa', false, 5, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false, "isClubParty": true, "stripIcon": "FDC"
  }'::jsonb),
  ('festa_del_rugby', 'Festa del Rugby', true, 6, '{
    "showCategory": true, "showOpponent": false, "showOpponents": true, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": true, "requiresCategory": true
  }'::jsonb),
  ('consiglio', 'Consiglio', false, 7, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": true, "showInvited": true,
    "showOrdineDelGiorno": true, "showVerbalePdf": true, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false, "stripIcon": "CON"
  }'::jsonb),
  ('incontro_genitori', 'Incontro Genitori', false, 8, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false, "stripIcon": "GEN"
  }'::jsonb),
  ('incontro_staff', 'Incontro Staff', false, 9, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false
  }'::jsonb),
  ('altro', 'Altro', false, 10, '{
    "showCategory": false, "showOpponent": false, "showOpponents": false, "showHomeAway": false,
    "showChampionship": false, "showParticipants": false, "showInvited": false,
    "showOrdineDelGiorno": false, "showVerbalePdf": false, "timeFieldType": "start_end",
    "listUsesColumns": false, "requiresCategory": false
  }'::jsonb)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE event_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage event types" ON event_types;
CREATE POLICY "Authenticated users can manage event types" ON event_types
  FOR ALL USING (auth.role() = 'authenticated');
