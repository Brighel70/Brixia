-- ========================================
-- SCRIPT COMPLETO DI CORREZIONE DATABASE
-- ========================================

-- 1. CORREGGI LA TABELLA user_roles (completa la definizione)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. CREA GLI ENUM MANCANTI
DO $$ 
BEGIN
    -- Enum per status presenze
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
        CREATE TYPE attendance_status AS ENUM ('presente', 'assente', 'ritardo', 'uscita_anticipata');
    END IF;
    
    -- Enum per luoghi infortunio
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'injury_place') THEN
        CREATE TYPE injury_place AS ENUM ('testa', 'collo', 'spalla', 'braccio', 'gomito', 'avambraccio', 'polso', 'mano', 'torace', 'schiena', 'addome', 'bacino', 'coscia', 'ginocchio', 'polpaccio', 'caviglia', 'piede');
    END IF;
    
    -- Enum per location sessioni
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_location') THEN
        CREATE TYPE session_location AS ENUM ('Brescia', 'Ospitaletto', 'Gussago', 'Altro');
    END IF;
    
    -- Enum per ruoli profili
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
        CREATE TYPE role_enum AS ENUM ('admin', 'dirigente', 'segreteria', 'direttore_sportivo', 'direttore_tecnico', 'allenatore', 'team_manager', 'accompagnatore', 'player', 'preparatore', 'medico', 'fisio', 'famiglia');
    END IF;
END $$;

-- 3. AGGIORNA LE TABELLE CON GLI ENUM CORRETTI
ALTER TABLE attendance 
ALTER COLUMN status TYPE attendance_status USING status::attendance_status,
ALTER COLUMN injured_place TYPE injury_place USING injured_place::injury_place;

ALTER TABLE sessions 
ALTER COLUMN location TYPE session_location USING location::session_location;

ALTER TABLE profiles 
ALTER COLUMN role TYPE role_enum USING role::role_enum;

-- 4. RIMUOVI CAMPI DUPLICATI E INUTILIZZATI
ALTER TABLE players DROP COLUMN IF EXISTS player_position_id_2;
ALTER TABLE players DROP COLUMN IF EXISTS aggregated_seniores;
ALTER TABLE players DROP COLUMN IF EXISTS injured;

-- Rimuovi campi ARRAY non utilizzati da events
ALTER TABLE events DROP COLUMN IF EXISTS opponents;
ALTER TABLE events DROP COLUMN IF EXISTS participants;
ALTER TABLE events DROP COLUMN IF EXISTS invited;
ALTER TABLE events DROP COLUMN IF EXISTS verbale_pdfs;

-- 5. RIMUOVI TABELLE DUPLICATE (mantieni solo le versioni in inglese)
DROP TABLE IF EXISTS eventi CASCADE;
DROP TABLE IF EXISTS presenze CASCADE;

-- 6. AGGIORNA LE FOREIGN KEY ROTTE
-- Aggiorna presenze per usare attendance
UPDATE attendance 
SET session_id = (SELECT id FROM sessions WHERE sessions.id = attendance.session_id)
WHERE session_id IS NOT NULL;

-- 7. CREA INDICI PER PERFORMANCE
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

-- 8. AGGIORNA I VALORI DI DEFAULT
UPDATE categories SET active = true WHERE active IS NULL;
UPDATE consent_types SET active = true WHERE active IS NULL;
UPDATE consent_types SET required_for_minor = false WHERE required_for_minor IS NULL;
UPDATE consent_types SET required_for_adult = false WHERE required_for_adult IS NULL;
UPDATE consent_types SET version = 1 WHERE version IS NULL;

-- 9. AGGIORNA I CHECK CONSTRAINTS
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

-- 10. AGGIORNA I VALORI DI DEFAULT MANCANTI
ALTER TABLE categories ALTER COLUMN active SET DEFAULT true;
ALTER TABLE consent_types ALTER COLUMN active SET DEFAULT true;
ALTER TABLE consent_types ALTER COLUMN required_for_minor SET DEFAULT false;
ALTER TABLE consent_types ALTER COLUMN required_for_adult SET DEFAULT false;
ALTER TABLE consent_types ALTER COLUMN version SET DEFAULT 1;

-- 11. VERIFICA FINALE
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
  'Enum creati' as info,
  COUNT(*) as count
FROM pg_type 
WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND typtype = 'e';

