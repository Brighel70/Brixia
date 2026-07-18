-- Aggiunge il sistema QR Code per le presenze
-- Esegui questo script in SQL Editor di Supabase

-- 1. Aggiunge il campo qr_active alla tabella sessions
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS qr_active BOOLEAN DEFAULT false;

-- 2. Aggiunge il campo qr_code alla tabella sessions per memorizzare il QR generato
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- 3. Aggiunge il campo scanned_at alla tabella attendance per tracciare quando è stata scansionata
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE;

-- 4. Aggiunge il campo qr_data alla tabella attendance per memorizzare i dati del QR
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS qr_data JSONB;

-- 5. Crea un indice per migliorare le performance delle query QR
CREATE INDEX IF NOT EXISTS idx_sessions_qr_active ON public.sessions(qr_active);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned_at ON public.attendance(scanned_at);

-- 6. Aggiunge una funzione per generare QR code univoci
CREATE OR REPLACE FUNCTION generate_session_qr_code(session_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN 'BRIXIA-' || session_id::TEXT || '-' || EXTRACT(EPOCH FROM NOW())::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 7. Aggiunge una funzione per validare QR code
CREATE OR REPLACE FUNCTION validate_qr_code(qr_text TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  session_id UUID,
  session_data JSONB
) AS $$
DECLARE
  session_uuid UUID;
  session_info JSONB;
BEGIN
  -- Estrae l'UUID dalla stringa QR
  BEGIN
    session_uuid := (regexp_split_to_array(qr_text, '-'))[2]::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB;
    RETURN;
  END;

  -- Verifica che la sessione esista e sia attiva
  SELECT 
    s.id,
    to_jsonb(s.*)
  INTO session_uuid, session_info
  FROM sessions s
  WHERE s.id = session_uuid 
    AND s.qr_active = true
    AND s.session_date = CURRENT_DATE;

  IF session_uuid IS NOT NULL THEN
    RETURN QUERY SELECT true, session_uuid, session_info;
  ELSE
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Aggiunge una vista per le statistiche QR in tempo reale
CREATE OR REPLACE VIEW qr_attendance_stats AS
SELECT 
  s.id as session_id,
  s.session_date,
  s.location,
  s.away_place,
  c.name as category_name,
  c.code as category_code,
  s.qr_active,
  COUNT(a.id) as total_attendance,
  COUNT(CASE WHEN a.status = 'PRESENTE' THEN 1 END) as present_count,
  COUNT(CASE WHEN a.status = 'ASSENTE' THEN 1 END) as absent_count,
  COUNT(CASE WHEN a.scanned_at IS NOT NULL THEN 1 END) as qr_scanned_count,
  ROUND(
    (COUNT(CASE WHEN a.status = 'PRESENTE' THEN 1 END)::DECIMAL / 
     NULLIF(COUNT(a.id), 0)) * 100, 2
  ) as attendance_percentage
FROM sessions s
LEFT JOIN categories c ON s.category_id = c.id
LEFT JOIN attendance a ON s.id = a.session_id
WHERE s.session_date = CURRENT_DATE
GROUP BY s.id, s.session_date, s.location, s.away_place, c.name, c.code, s.qr_active
ORDER BY s.start_time;

-- 9. Aggiunge una funzione per ottenere le sessioni attive per QR
CREATE OR REPLACE FUNCTION get_active_qr_sessions()
RETURNS TABLE (
  session_id UUID,
  session_date DATE,
  location TEXT,
  away_place TEXT,
  start_time TIME,
  end_time TIME,
  category_name TEXT,
  category_code TEXT,
  qr_code TEXT,
  attendance_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.session_date,
    s.location,
    s.away_place,
    s.start_time,
    s.end_time,
    c.name,
    c.code,
    s.qr_code,
    COALESCE(COUNT(a.id), 0) as attendance_count
  FROM sessions s
  LEFT JOIN categories c ON s.category_id = c.id
  LEFT JOIN attendance a ON s.id = a.session_id
  WHERE s.qr_active = true
    AND s.session_date = CURRENT_DATE
  GROUP BY s.id, s.session_date, s.location, s.away_place, s.start_time, s.end_time, c.name, c.code, s.qr_code
  ORDER BY s.start_time;
END;
$$ LANGUAGE plpgsql;

-- 10. Aggiunge trigger per aggiornare qr_code quando qr_active diventa true
CREATE OR REPLACE FUNCTION update_session_qr_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.qr_active = true AND OLD.qr_active = false THEN
    NEW.qr_code := generate_session_qr_code(NEW.id);
  END IF;
  
  IF NEW.qr_active = false THEN
    NEW.qr_code := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_qr_code
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_qr_code();

-- 11. Aggiunge commenti per documentazione
COMMENT ON COLUMN sessions.qr_active IS 'Indica se la sessione è attiva per la scansione QR';
COMMENT ON COLUMN sessions.qr_code IS 'Codice QR univoco generato per la sessione';
COMMENT ON COLUMN attendance.scanned_at IS 'Timestamp di quando la presenza è stata registrata via QR';
COMMENT ON COLUMN attendance.qr_data IS 'Dati del QR code utilizzato per registrare la presenza';

-- 12. Inserisce dati di esempio per test (opzionale)
-- INSERT INTO sessions (category_id, session_date, location, qr_active) 
-- SELECT id, CURRENT_DATE, 'Brescia', true 
-- FROM categories 
-- WHERE code = 'U16' 
-- LIMIT 1;
