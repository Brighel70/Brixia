-- ========================================
-- SCRIPT DI OTTIMIZZAZIONE INDICI DATABASE - VERSIONE CORRETTA
-- ========================================
-- Questo script crea indici ottimizzati per migliorare le performance delle query
-- Versione compatibile con Supabase/PostgreSQL

-- ========================================
-- 1. INDICI PER TABELLA PLAYERS
-- ========================================

-- Indice per ordinamento per cognome (query frequente)
CREATE INDEX IF NOT EXISTS idx_players_last_name 
ON players (last_name ASC);

-- Indice per ordinamento per nome (query frequente)
CREATE INDEX IF NOT EXISTS idx_players_first_name 
ON players (first_name ASC);

-- Indice per ricerca per codice FIR
CREATE INDEX IF NOT EXISTS idx_players_fir_code 
ON players (fir_code);

-- Indice per filtraggio giocatori infortunati
CREATE INDEX IF NOT EXISTS idx_players_injured 
ON players (injured) WHERE injured = true;

-- Indice per filtraggio giocatori aggregati
CREATE INDEX IF NOT EXISTS idx_players_aggregated 
ON players (aggregated_seniores) WHERE aggregated_seniores = true;

-- Indice per data di nascita (per calcolo età)
CREATE INDEX IF NOT EXISTS idx_players_birth_date 
ON players (birth_date);

-- Indice composito per ricerca combinata
CREATE INDEX IF NOT EXISTS idx_players_search 
ON players (last_name, first_name, fir_code);

-- ========================================
-- 2. INDICI PER TABELLA CATEGORIES
-- ========================================

-- Indice per ordinamento per sort
CREATE INDEX IF NOT EXISTS idx_categories_sort 
ON categories (sort ASC);

-- Indice per filtraggio categorie attive
CREATE INDEX IF NOT EXISTS idx_categories_active 
ON categories (active) WHERE active = true;

-- Indice per ricerca per codice
CREATE INDEX IF NOT EXISTS idx_categories_code 
ON categories (code);

-- ========================================
-- 3. INDICI PER TABELLA SESSIONS
-- ========================================

-- Indice per ordinamento per data sessione
CREATE INDEX IF NOT EXISTS idx_sessions_date 
ON sessions (session_date DESC);

-- Indice per filtraggio per categoria
CREATE INDEX IF NOT EXISTS idx_sessions_category 
ON sessions (category_id);

-- Indice composito per query frequenti
CREATE INDEX IF NOT EXISTS idx_sessions_category_date 
ON sessions (category_id, session_date DESC);

-- ========================================
-- 4. INDICI PER TABELLA EVENTS
-- ========================================

-- Indice per ordinamento per data evento
CREATE INDEX IF NOT EXISTS idx_events_date 
ON events (event_date ASC);

-- Indice per filtraggio per categoria
CREATE INDEX IF NOT EXISTS idx_events_category 
ON events (category_id);

-- Indice per filtraggio per tipo evento
CREATE INDEX IF NOT EXISTS idx_events_type 
ON events (event_type);

-- Indice composito per query frequenti
CREATE INDEX IF NOT EXISTS idx_events_category_date 
ON events (category_id, event_date ASC);

-- ========================================
-- 5. INDICI PER TABELLA ATTENDANCE
-- ========================================

-- Indice per filtraggio per sessione
CREATE INDEX IF NOT EXISTS idx_attendance_session 
ON attendance (session_id);

-- Indice per filtraggio per giocatore
CREATE INDEX IF NOT EXISTS idx_attendance_player 
ON attendance (player_id);

-- Indice per filtraggio per status
CREATE INDEX IF NOT EXISTS idx_attendance_status 
ON attendance (status);

-- Indice composito per query frequenti
CREATE INDEX IF NOT EXISTS idx_attendance_session_player 
ON attendance (session_id, player_id);

-- ========================================
-- 6. INDICI PER TABELLA PROFILES
-- ========================================

-- Indice per ordinamento per cognome
CREATE INDEX IF NOT EXISTS idx_profiles_last_name 
ON profiles (last_name ASC);

-- Indice per ordinamento per nome
CREATE INDEX IF NOT EXISTS idx_profiles_first_name 
ON profiles (first_name ASC);

-- Indice per filtraggio per ruolo
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles (role);

-- Indice per ricerca per email
CREATE INDEX IF NOT EXISTS idx_profiles_email 
ON profiles (email);

-- Indice per filtraggio profili validi
CREATE INDEX IF NOT EXISTS idx_profiles_valid 
ON profiles (first_name) WHERE first_name IS NOT NULL AND first_name != '';

-- ========================================
-- 7. INDICI PER TABELLE DI ASSOCIAZIONE
-- ========================================

-- Indici per player_categories
CREATE INDEX IF NOT EXISTS idx_player_categories_player 
ON player_categories (player_id);

CREATE INDEX IF NOT EXISTS idx_player_categories_category 
ON player_categories (category_id);

-- Indici per staff_categories
CREATE INDEX IF NOT EXISTS idx_staff_categories_staff 
ON staff_categories (user_id);

CREATE INDEX IF NOT EXISTS idx_staff_categories_category 
ON staff_categories (category_id);

-- ========================================
-- 8. INDICI PER TABELLA TRAINING_LOCATIONS
-- ========================================

-- Indice per filtraggio per categoria
CREATE INDEX IF NOT EXISTS idx_training_locations_category 
ON training_locations (category_id);

-- Indice per ordinamento per giorno e orario
CREATE INDEX IF NOT EXISTS idx_training_locations_schedule 
ON training_locations (category_id, weekday, start_time);

-- ========================================
-- 9. INDICI PER TABELLA NOTES
-- ========================================

-- Indice per filtraggio per persona
CREATE INDEX IF NOT EXISTS idx_notes_person 
ON notes (person_id);

-- Indice per ordinamento per data creazione
CREATE INDEX IF NOT EXISTS idx_notes_created 
ON notes (created_at DESC);

-- ========================================
-- 10. INDICI PER TABELLA INJURIES
-- ========================================

-- Indice per filtraggio per giocatore
CREATE INDEX IF NOT EXISTS idx_injuries_player 
ON injuries (player_id);

-- Indice per filtraggio per data infortunio
CREATE INDEX IF NOT EXISTS idx_injuries_date 
ON injuries (injury_date DESC);

-- Indice per filtraggio per status
CREATE INDEX IF NOT EXISTS idx_injuries_status 
ON injuries (status);

-- ========================================
-- 11. INDICI PER TABELLA USER_ROLES
-- ========================================

-- Indice per ricerca per nome ruolo
CREATE INDEX IF NOT EXISTS idx_user_roles_name 
ON user_roles (name);

-- ========================================
-- 12. INDICI PER TABELLA PERMISSIONS
-- ========================================

-- Indice per ricerca per nome permesso
CREATE INDEX IF NOT EXISTS idx_permissions_name 
ON permissions (name);

-- ========================================
-- 13. INDICI PER TABELLA ROLE_PERMISSIONS
-- ========================================

-- Indici per associazioni ruolo-permesso
CREATE INDEX IF NOT EXISTS idx_role_permissions_role 
ON role_permissions (role_id);

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission 
ON role_permissions (permission_id);

-- ========================================
-- 14. ANALISI E STATISTICHE
-- ========================================

-- Aggiorna le statistiche del database
ANALYZE;

-- ========================================
-- 15. VERIFICA INDICI CREATI
-- ========================================

-- Query per verificare gli indici creati
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ========================================
-- 16. STATISTICHE PERFORMANCE
-- ========================================

-- Query per vedere le dimensioni delle tabelle
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query per vedere gli indici più utilizzati
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- ========================================
-- FINE SCRIPT
-- ========================================


