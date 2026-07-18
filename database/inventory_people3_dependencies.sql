-- =============================================================================
-- INVENTARIO DIPENDENZE people3
-- =============================================================================
-- Esegui nel SQL Editor di Supabase PRIMA di considerare il DROP di people3.
-- Tutte le sezioni devono restituire 0 righe (o nessuna dipendenza attiva).
-- =============================================================================

-- 1) Foreign Keys che puntano a people3
-- -----------------------------------------------------------------------------
SELECT '=== 1. FK CHE PUNTANO A PEOPLE3 ===' AS section;
SELECT 
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'people3'
  AND tc.table_schema = 'public';
-- Atteso: 0 righe

-- 2) Views che referenziano people3
-- -----------------------------------------------------------------------------
SELECT '=== 2. VIEWS CHE USANO PEOPLE3 ===' AS section;
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND (definition ILIKE '%people3%' OR viewname ILIKE '%people3%');
-- Atteso: 0 righe

-- 3) Materialized views che referenziano people3
-- -----------------------------------------------------------------------------
SELECT '=== 3. MATERIALIZED VIEWS CHE USANO PEOPLE3 ===' AS section;
SELECT 
  schemaname,
  matviewname,
  definition
FROM pg_matviews
WHERE schemaname = 'public'
  AND (definition ILIKE '%people3%' OR matviewname ILIKE '%people3%');
-- Atteso: 0 righe (o tabella non esiste in pg_matviews)

-- 4) Functions (plpgsql) che contengono "people3"
-- -----------------------------------------------------------------------------
SELECT '=== 4. FUNCTIONS CHE CONTENGONO PEOPLE3 ===' AS section;
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%people3%';
-- Atteso: 0 righe

-- 5) Triggers legati a people3
-- -----------------------------------------------------------------------------
SELECT '=== 5. TRIGGERS SU PEOPLE3 ===' AS section;
SELECT 
  tgname AS trigger_name,
  relname AS table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'people3'
  AND NOT t.tgisinternal;
-- Atteso: 0 righe (o nessun trigger custom)

-- 6) Policies RLS su people3
-- -----------------------------------------------------------------------------
SELECT '=== 6. POLICIES RLS SU PEOPLE3 ===' AS section;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'people3';
-- Atteso: 0 righe (o RLS disabilitata)

-- 7) Tabelle che hanno RLS e potrebbero referenziare people3 nelle policy
-- -----------------------------------------------------------------------------
SELECT '=== 7. POLICIES RLS CHE MENTIONANO PEOPLE3 ===' AS section;
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') ILIKE '%people3%' OR COALESCE(with_check, '') ILIKE '%people3%');
-- Atteso: 0 righe

-- 8) Indici su people3 (solo informativo)
-- -----------------------------------------------------------------------------
SELECT '=== 8. INDICI SU PEOPLE3 (info) ===' AS section;
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'people3';

-- 9) Constraint su people3 (solo informativo)
-- -----------------------------------------------------------------------------
SELECT '=== 9. CONSTRAINT SU PEOPLE3 (info) ===' AS section;
SELECT 
  conname AS constraint_name,
  contype AS type
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'people3';

-- 10) Conteggio record (per conferma export)
-- -----------------------------------------------------------------------------
SELECT '=== 10. CONTEGGIO RECORD PEOPLE3 ===' AS section;
SELECT COUNT(*) AS people3_row_count 
FROM public.people3 
WHERE EXISTS (SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'people3');
