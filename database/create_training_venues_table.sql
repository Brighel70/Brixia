-- Sedi di allenamento configurabili (Impostazioni → Sedi allenamento)
-- Eseguire su Supabase prima di usare la gestione sedi nel gestionale.

CREATE TABLE IF NOT EXISTS training_venues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_home_venue BOOLEAN NOT NULL DEFAULT true,
  requires_away_detail BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_venues_active_sort ON training_venues(active, sort_order);

COMMENT ON TABLE training_venues IS 'Anagrafica sedi: dropdown categorie, sessioni, eventi';
COMMENT ON COLUMN training_venues.is_home_venue IS 'Sede di casa del club (auto flag "in casa" negli eventi)';
COMMENT ON COLUMN training_venues.requires_away_detail IS 'Richiede campo aggiuntivo "Dove" (es. Trasferta)';

-- sessions.location: enum → TEXT (la view qr_attendance_stats va droppata prima)
DROP VIEW IF EXISTS public.qr_attendance_stats;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
    WHERE c.table_schema = 'public'
      AND c.table_name = 'sessions'
      AND c.column_name = 'location'
      AND t.typtype = 'e'
  ) THEN
    ALTER TABLE public.sessions
      ALTER COLUMN location TYPE TEXT USING location::TEXT;
  END IF;
END $$;

-- Ricrea view statistiche QR (identica a database/add_qr_system_fixed.sql)
CREATE OR REPLACE VIEW public.qr_attendance_stats AS
SELECT
  s.id AS session_id,
  s.session_date,
  s.location,
  s.away_place,
  c.name AS category_name,
  c.code AS category_code,
  s.qr_active,
  COUNT(a.id) AS total_attendance,
  COUNT(CASE WHEN a.status = 'PRESENTE' THEN 1 END) AS present_count,
  COUNT(CASE WHEN a.status = 'ASSENTE' THEN 1 END) AS absent_count,
  COUNT(CASE WHEN a.scanned_at IS NOT NULL THEN 1 END) AS qr_scanned_count,
  ROUND(
    (COUNT(CASE WHEN a.status = 'PRESENTE' THEN 1 END)::DECIMAL /
     NULLIF(COUNT(a.id), 0)) * 100, 2
  ) AS attendance_percentage
FROM sessions s
LEFT JOIN categories c ON s.category_id = c.id
LEFT JOIN attendance a ON s.id = a.session_id
WHERE s.session_date = CURRENT_DATE
GROUP BY s.id, s.session_date, s.location, s.away_place, c.name, c.code, s.qr_active
ORDER BY s.start_time;

-- Rimuovi vincolo fisso sulle tre sedi in training_locations (se presente)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'training_locations'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%location%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.training_locations DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Migra sedi già usate in training_locations e sessions
INSERT INTO training_venues (name, is_home_venue, requires_away_detail, sort_order)
SELECT DISTINCT loc, true, false, 0
FROM (
  SELECT trim(location::text) AS loc
  FROM training_locations
  WHERE location IS NOT NULL AND trim(location::text) <> ''
  UNION
  SELECT trim(location::text) AS loc
  FROM sessions
  WHERE location IS NOT NULL AND trim(location::text) <> ''
) AS existing
WHERE loc NOT IN ('Trasferta', 'Altro')
ON CONFLICT (name) DO NOTHING;

INSERT INTO training_venues (name, is_home_venue, requires_away_detail, sort_order)
VALUES ('Trasferta', false, true, 900)
ON CONFLICT (name) DO NOTHING;

INSERT INTO training_venues (name, is_home_venue, requires_away_detail, sort_order)
VALUES ('Altro', false, false, 910)
ON CONFLICT (name) DO NOTHING;

-- Ordine iniziale alfabetico per le sedi migrate
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM training_venues
  WHERE name NOT IN ('Trasferta', 'Altro')
)
UPDATE training_venues tv
SET sort_order = ordered.rn
FROM ordered
WHERE tv.id = ordered.id;

ALTER TABLE training_venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage training venues" ON training_venues;
CREATE POLICY "Authenticated users can manage training venues" ON training_venues
  FOR ALL USING (auth.role() = 'authenticated');
