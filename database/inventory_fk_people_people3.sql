-- DEPRECATED: usare people. Script diagnostico legacy.
-- =============================================================================
-- INVENTARIO FK: people vs people3
-- =============================================================================
-- Esegui nel SQL Editor di Supabase per verificare lo stato attuale delle FK.
-- Utile prima e dopo la migrazione.
-- =============================================================================

-- 1) Tabelle che referenziano people3
SELECT '=== FK CHE PUNTANO A PEOPLE3 ===' AS section;
SELECT 
  conrelid::regclass AS tabella,
  a.attname AS colonna,
  conname AS constraint_name,
  confrelid::regclass AS riferisce_a
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.contype = 'f' 
  AND c.confrelid = 'public.people3'::regclass
ORDER BY conrelid::regclass::text, a.attname;

-- 2) Tabelle che referenziano people
SELECT '=== FK CHE PUNTANO A PEOPLE ===' AS section;
SELECT 
  conrelid::regclass AS tabella,
  a.attname AS colonna,
  conname AS constraint_name,
  confrelid::regclass AS riferisce_a
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attnum > 0 AND NOT a.attisdropped
WHERE c.contype = 'f' 
  AND c.confrelid = 'public.people'::regclass
ORDER BY conrelid::regclass::text, a.attname;

-- 3) Colonne person_id / created_by / guardian / tutor / athlete (potenziali FK persone)
SELECT '=== COLONNE POTENZIALMENTE LEGATE A PERSONE ===' AS section;
SELECT 
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  col.data_type,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  AND tc.table_name = kcu.table_name
LEFT JOIN information_schema.columns col
  ON col.table_schema = kcu.table_schema AND col.table_name = kcu.table_name AND col.column_name = kcu.column_name
LEFT JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name IN ('person_id', 'created_by', 'player_person_id', 'guardian_person_id', 
      'child_person_id', 'tutor_id', 'athlete_id', 'family_id', 'player_id')
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4) Esistenza tabelle people / people3
SELECT '=== ESISTENZA TABELLE ===' AS section;
SELECT 
  table_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables t2 
                   WHERE t2.table_schema = 'public' AND t2.table_name = t.table_name) 
       THEN 'Esiste' ELSE 'Non esiste' END AS stato
FROM (VALUES ('people'), ('people3')) AS t(table_name);

-- 5) Conteggio record
SELECT '=== CONTEGGI RECORD ===' AS section;
SELECT 'people' AS tabella, COUNT(*) AS n FROM public.people
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people')
UNION ALL
SELECT 'people3', COUNT(*) FROM public.people3
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people3');
