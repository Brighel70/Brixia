-- Tabella per le società di origine (dove ha giocato il giocatore prima di entrare in Under 14 nel Brixia)
CREATE TABLE IF NOT EXISTS origin_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indice per ordinamento
CREATE INDEX IF NOT EXISTS idx_origin_clubs_sort ON origin_clubs(sort_order);

-- Inserimento società predefinite
INSERT INTO origin_clubs (name, sort_order) VALUES
  ('Gussago', 1),
  ('Ospitaletto', 2),
  ('Brescia', 3),
  ('Fiumicello', 4),
  ('Botticino', 5),
  ('Rovato', 6),
  ('Bassa Bresciana', 7),
  ('Union Garda', 8),
  ('Oltremella', 9),
  ('Centurioni', 10),
  ('Verona', 11),
  ('Mantova', 12),
  ('Bergamo', 13)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE origin_clubs IS 'Società di origine: elenco di squadre per il campo "dove ha giocato prima di Under 14 Brixia"';
