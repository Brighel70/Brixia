-- ========================================
-- SCRIPT ULTRA SICURO DI CORREZIONE DATABASE
-- ========================================

-- 1. CORREGGI LA TABELLA user_roles (completa la definizione)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. NON CREARE NESSUN ENUM NUOVO - usa solo quelli esistenti

-- 3. RIMUOVI CAMPI DUPLICATI E INUTILIZZATI
ALTER TABLE players DROP COLUMN IF EXISTS player_position_id_2;
ALTER TABLE players DROP COLUMN IF EXISTS aggregated_seniores;
ALTER TABLE players DROP COLUMN IF EXISTS injured;

-- Rimuovi campi ARRAY non utilizzati da events
ALTER TABLE events DROP COLUMN IF EXISTS opponents;
ALTER TABLE events DROP COLUMN IF EXISTS participants;
ALTER TABLE events DROP COLUMN IF EXISTS invited;
ALTER TABLE events DROP COLUMN IF EXISTS verbale_pdfs;

-- 4. RIMUOVI TABELLE DUPLICATE (mantieni solo le versioni in inglese)
DROP TABLE IF EXISTS eventi CASCADE;
DROP TABLE IF EXISTS presenze CASCADE;

-- 5. CREA INDICI PER PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id ON attendance(player_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(created_at);

CREATE INDEX IF NOT EXISTS idx_players_person_id ON players(person_id);
CREATE INDEX IF NOT EXISTS idx_players_birth_year ON players(birth_year);
CREATE INDEX IF NOT EXISTS idx_players_fir_code ON players(fir_code);

CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

CREATE INDEX IF NOT EXISTS idx_sessions_category_id ON sessions(category_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_date ON sessions(session_date);

CREATE INDEX IF NOT EXISTS idx_people_fiscal_code ON people(fiscal_code);
CREATE INDEX IF NOT EXISTS idx_people_email ON people(email);
CREATE INDEX IF NOT EXISTS idx_people_membership_number ON people(membership_number);

CREATE INDEX IF NOT EXISTS idx_profiles_user_role_id ON profiles(user_role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_person_id ON profiles(person_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- 6. AGGIORNA I VALORI DI DEFAULT
UPDATE categories SET active = true WHERE active IS NULL;
UPDATE consent_types SET active = true WHERE active IS NULL;
UPDATE consent_types SET required_for_minor = false WHERE required_for_minor IS NULL;
UPDATE consent_types SET required_for_adult = false WHERE required_for_adult IS NULL;
UPDATE consent_types SET version = 1 WHERE version IS NULL;

-- 7. AGGIORNA I CHECK CONSTRAINTS
ALTER TABLE council_members DROP CONSTRAINT IF EXISTS council_members_role_check;
ALTER TABLE council_members ADD CONSTRAINT council_members_role_check 
CHECK (role = ANY (ARRAY['president'::text, 'vice_president'::text, 'counselor'::text]));

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_visibility_check;
ALTER TABLE documents ADD CONSTRAINT documents_visibility_check 
CHECK (visibility = ANY (ARRAY['private_admin'::text, 'staff'::text, 'owner_only'::text, 'owner_guardians'::text]));

ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_severity_check;
ALTER TABLE injuries ADD CONSTRAINT injuries_severity_check 
CHECK (severity = ANY (ARRAY['Lieve'::text, 'Moderato'::text, 'Grave'::text]));

ALTER TABLE injuries DROP CONSTRAINT IF EXISTS injuries_current_status_check;
ALTER TABLE injuries ADD CONSTRAINT injuries_current_status_check 
CHECK (current_status = ANY (ARRAY['In corso'::text, 'Guarito'::text, 'Ricaduta'::text, 'Cronico'::text]));

ALTER TABLE medical_certificates DROP CONSTRAINT IF EXISTS medical_certificates_kind_check;
ALTER TABLE medical_certificates ADD CONSTRAINT medical_certificates_kind_check 
CHECK (kind = ANY (ARRAY['non_agonistico'::text, 'agonistico'::text]));

ALTER TABLE medical_certificates DROP CONSTRAINT IF EXISTS medical_certificates_status_check;
ALTER TABLE medical_certificates ADD CONSTRAINT medical_certificates_status_check 
CHECK (status = ANY (ARRAY['valid'::text, 'expired'::text, 'missing'::text]));

ALTER TABLE people DROP CONSTRAINT IF EXISTS people_gender_check;
ALTER TABLE people ADD CONSTRAINT people_gender_check 
CHECK (gender = ANY (ARRAY['M'::text, 'F'::text, 'X'::text]));

ALTER TABLE people DROP CONSTRAINT IF EXISTS people_status_check;
ALTER TABLE people ADD CONSTRAINT people_status_check 
CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text]));

-- 8. AGGIORNA I VALORI DI DEFAULT MANCANTI
ALTER TABLE categories ALTER COLUMN active SET DEFAULT true;
ALTER TABLE consent_types ALTER COLUMN active SET DEFAULT true;
ALTER TABLE consent_types ALTER COLUMN required_for_minor SET DEFAULT false;
ALTER TABLE consent_types ALTER COLUMN required_for_adult SET DEFAULT false;
ALTER TABLE consent_types ALTER COLUMN version SET DEFAULT 1;

-- 9. VERIFICA FINALE
SELECT 
  'Tabelle corrette' as info,
  COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public';

SELECT 
  'Indici creati' as info,
  COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public';

SELECT 
  'Enum esistenti' as info,
  COUNT(*) as count
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e';

-- Verifica i valori nella tabella attendance
SELECT 
  'Valori attendance' as info,
  status,
  COUNT(*) as count
FROM attendance 
GROUP BY status
ORDER BY status;

-- Verifica la struttura finale delle tabelle principali
SELECT 
  'Struttura attendance' as info,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'attendance' 
ORDER BY ordinal_position;

-- Verifica la struttura della tabella sessions
SELECT 
  'Struttura sessions' as info,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'sessions' 
ORDER BY ordinal_position;


