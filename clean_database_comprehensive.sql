-- ========================================
-- PULIZIA COMPLETA DATABASE - BRIXIA RUGBY
-- ========================================
-- Questo script pulisce il database rimuovendo duplicati e inconsistenze

-- 1. VERIFICA STATO ATTUALE
SELECT '=== STATO ATTUALE DATABASE ===' as info;

-- Mostra tutte le tabelle esistenti
SELECT 
  'Tabelle esistenti:' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Mostra tutti gli enum esistenti
SELECT 
  'Enum esistenti:' as info,
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%_enum'
ORDER BY t.typname, e.enumsortorder;

-- 2. RIMUOVI TABELLE DUPLICATE E INUTILIZZATE

-- Verifica se esiste player_positions (duplicato di roles)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_positions' AND table_schema = 'public') THEN
    -- Migra dati da player_positions a roles se necessario
    INSERT INTO roles (name, position_order, created_at)
    SELECT DISTINCT name, position_order, created_at
    FROM player_positions
    WHERE name NOT IN (SELECT name FROM roles)
    ON CONFLICT (name) DO NOTHING;
    
    -- Elimina la tabella duplicata
    DROP TABLE IF EXISTS player_positions CASCADE;
    RAISE NOTICE 'Tabella player_positions rimossa (duplicato di roles)';
  END IF;
END $$;

-- 3. PULISCI CAMPI INUTILIZZATI

-- Rimuovi campo password dalla tabella profiles (non dovrebbe essere lì)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'password' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE profiles DROP COLUMN password;
    RAISE NOTICE 'Campo password rimosso da profiles';
  END IF;
END $$;

-- 4. SISTEMAZIONE ENUM INCONSISTENTI

-- Aggiorna role_enum per includere tutti i ruoli reali
DO $$
BEGIN
  -- Prima crea un nuovo enum con tutti i ruoli
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum_new') THEN
    CREATE TYPE role_enum_new AS ENUM (
      'Admin', 'Dirigente', 'Segreteria', 'Direttore Sportivo', 'Direttore Tecnico',
      'Allenatore', 'Team Manager', 'Accompagnatore', 'Player', 'Preparatore',
      'Medico', 'Fisio', 'Famiglia'
    );
    
    -- Aggiorna la tabella profiles per usare il nuovo enum
    ALTER TABLE profiles ALTER COLUMN role TYPE role_enum_new USING role::text::role_enum_new;
    
    -- Rimuovi il vecchio enum e rinomina il nuovo
    DROP TYPE IF EXISTS role_enum CASCADE;
    ALTER TYPE role_enum_new RENAME TO role_enum;
    
    RAISE NOTICE 'Enum role_enum aggiornato con tutti i ruoli';
  END IF;
END $$;

-- 5. SISTEMAZIONE FOREIGN KEY ROTTE

-- Verifica e sistema le foreign key rotte
DO $$
DECLARE
  fk_record RECORD;
BEGIN
  -- Trova foreign key che puntano a tabelle inesistenti
  FOR fk_record IN
    SELECT 
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
  LOOP
    -- Verifica se la tabella referenziata esiste
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = fk_record.foreign_table_name 
      AND table_schema = 'public'
    ) THEN
      -- Rimuovi la foreign key rotta
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', 
                    fk_record.table_name, fk_record.constraint_name);
      RAISE NOTICE 'Foreign key rotta rimossa: %.% -> %.%', 
                   fk_record.table_name, fk_record.column_name,
                   fk_record.foreign_table_name, fk_record.foreign_column_name;
    END IF;
  END LOOP;
END $$;

-- 6. SISTEMAZIONE INDICI DUPLICATI

-- Rimuovi indici duplicati
DO $$
DECLARE
  idx_record RECORD;
BEGIN
  FOR idx_record IN
    SELECT 
      schemaname,
      tablename,
      indexname,
      COUNT(*) as count
    FROM pg_indexes 
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, indexname
    HAVING COUNT(*) > 1
  LOOP
    -- Rimuovi indici duplicati (mantieni solo il primo)
    EXECUTE format('DROP INDEX IF EXISTS %I.%I CASCADE', 
                  idx_record.schemaname, idx_record.indexname);
    RAISE NOTICE 'Indice duplicato rimosso: %.%', 
                 idx_record.schemaname, idx_record.indexname;
  END LOOP;
END $$;

-- 7. SISTEMAZIONE POLITICHE RLS DUPLICATE

-- Rimuovi politiche RLS duplicate
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT 
      schemaname,
      tablename,
      policyname,
      COUNT(*) as count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename, policyname
    HAVING COUNT(*) > 1
  LOOP
    -- Rimuovi politiche duplicate
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', 
                  policy_record.policyname, policy_record.schemaname, policy_record.tablename);
    RAISE NOTICE 'Politica RLS duplicata rimossa: %.%.%', 
                 policy_record.schemaname, policy_record.tablename, policy_record.policyname;
  END LOOP;
END $$;

-- 8. VERIFICA E SISTEMAZIONE DATI ORFANI

-- Rimuovi record orfani da player_categories
DELETE FROM player_categories 
WHERE player_id NOT IN (SELECT id FROM players)
   OR category_id NOT IN (SELECT id FROM categories);

-- Rimuovi record orfani da staff_categories
DELETE FROM staff_categories 
WHERE user_id NOT IN (SELECT id FROM profiles)
   OR category_id NOT IN (SELECT id FROM categories);

-- Rimuovi record orfani da role_permissions
DELETE FROM role_permissions 
WHERE role_id NOT IN (SELECT id FROM user_roles)
   OR permission_id NOT IN (SELECT id FROM permissions);

-- Rimuovi record orfani da attendance
DELETE FROM attendance 
WHERE player_id NOT IN (SELECT id FROM players)
   OR session_id NOT IN (SELECT id FROM sessions);

-- Rimuovi record orfani da sessions
DELETE FROM sessions 
WHERE category_id NOT IN (SELECT id FROM categories);

-- 9. AGGIORNA STATISTICHE

-- Aggiorna le statistiche del database
ANALYZE;

-- 10. VERIFICA FINALE

SELECT '=== STATO FINALE DATABASE ===' as info;

-- Mostra le tabelle finali
SELECT 
  'Tabelle finali:' as info,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Mostra gli enum finali
SELECT 
  'Enum finali:' as info,
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%_enum'
ORDER BY t.typname, e.enumsortorder;

-- Mostra le foreign key finali
SELECT 
  'Foreign key finali:' as info,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Mostra statistiche finali
SELECT 
  'Statistiche finali:' as info,
  'Tabelle' as tipo,
  COUNT(*) as numero
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
  'Statistiche finali:' as info,
  'Enum' as tipo,
  COUNT(DISTINCT t.typname) as numero
FROM pg_type t 
WHERE t.typname LIKE '%_enum'
UNION ALL
SELECT 
  'Statistiche finali:' as info,
  'Foreign Key' as tipo,
  COUNT(*) as numero
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY' 
  AND table_schema = 'public';

SELECT '=== PULIZIA COMPLETATA ===' as info;

