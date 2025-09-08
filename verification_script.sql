-- =====================================================
-- SCRIPT DI VERIFICA MIGRAZIONE PEOPLE
-- =====================================================
-- Eseguire questo script per verificare che tutto sia stato implementato correttamente

-- =====================================================
-- 1. VERIFICA TABELLE CREATE
-- =====================================================

SELECT 'TABELLE CREATE' as verifica;

-- Controlla se le nuove tabelle esistono
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'people', 
    'guardians', 
    'medical_certificates', 
    'consent_types', 
    'person_consents', 
    'documents'
  )
ORDER BY tablename;

-- =====================================================
-- 2. VERIFICA COLONNE AGGIUNTE ALLE TABELLE ESISTENTI
-- =====================================================

SELECT 'COLONNE AGGIUNTE' as verifica;

-- Verifica players.person_id
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'players' 
  AND column_name = 'person_id';

-- Verifica profiles.person_id
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'person_id';

-- =====================================================
-- 3. VERIFICA FOREIGN KEY E VINCOLI
-- =====================================================

SELECT 'FOREIGN KEY E VINCOLI' as verifica;

-- Foreign Key di players.person_id
SELECT 
  tc.constraint_name,
  tc.table_name,
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
  AND tc.table_name = 'players'
  AND kcu.column_name = 'person_id';

-- Foreign Key di profiles.person_id
SELECT 
  tc.constraint_name,
  tc.table_name,
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
  AND tc.table_name = 'profiles'
  AND kcu.column_name = 'person_id';

-- Vincoli CHECK su people
SELECT 
  tc.constraint_name,
  tc.table_name,
  cc.check_clause
FROM information_schema.table_constraints AS tc
JOIN information_schema.check_constraints AS cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_name = 'people';

-- =====================================================
-- 4. VERIFICA FUNZIONI CREATE
-- =====================================================

SELECT 'FUNZIONI CREATE' as verifica;

SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'compute_is_minor',
    'trg_people_minor',
    'trg_people_membership',
    'is_valid_cf',
    'trg_med_cert_status',
    'sign_consent',
    'set_updated_at',
    'check_minor_guardian'
  )
ORDER BY routine_name;

-- =====================================================
-- 5. VERIFICA TRIGGER ATTIVI
-- =====================================================

SELECT 'TRIGGER ATTIVI' as verifica;

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name IN (
    'trg_people_updated',
    'trg_people_bi_minor',
    'trg_people_bi_membership',
    'trg_people_minor_guard',
    'trg_med_cert_bu_status'
  )
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- 6. VERIFICA VIEW CREATE
-- =====================================================

SELECT 'VIEW CREATE' as verifica;

SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'v_person_medical_status';

-- =====================================================
-- 7. VERIFICA SEQUENZE
-- =====================================================

SELECT 'SEQUENZE CREATE' as verifica;

SELECT 
  sequence_name,
  data_type,
  start_value,
  increment
FROM information_schema.sequences 
WHERE sequence_schema = 'public' 
  AND sequence_name = 'seq_membership';

-- =====================================================
-- 8. VERIFICA RLS POLICIES
-- =====================================================

SELECT 'RLS POLICIES' as verifica;

-- Controlla se RLS è abilitato
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'people', 
    'guardians', 
    'medical_certificates', 
    'person_consents', 
    'documents'
  )
ORDER BY tablename;

-- Controlla le policies create
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
  AND tablename IN (
    'people', 
    'guardians', 
    'medical_certificates', 
    'person_consents', 
    'documents'
  )
ORDER BY tablename, policyname;

-- =====================================================
-- 9. TEST FUNZIONALITÀ
-- =====================================================

SELECT 'TEST FUNZIONALITÀ' as verifica;

-- Test inserimento persona (maggiorenne)
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email) 
VALUES ('Test Maggiorenne', 'Test', 'Maggiorenne', '1990-01-01', 'test.maggiorenne@example.com')
ON CONFLICT (email) DO NOTHING;

-- Test inserimento persona (minorenne)
INSERT INTO public.people (full_name, given_name, family_name, date_of_birth, email) 
VALUES ('Test Minorenne', 'Test', 'Minorenne', '2010-01-01', 'test.minorenne@example.com')
ON CONFLICT (email) DO NOTHING;

-- Verifica che is_minor sia calcolato correttamente
SELECT 
  full_name,
  date_of_birth,
  is_minor,
  membership_number
FROM public.people 
WHERE email IN ('test.maggiorenne@example.com', 'test.minorenne@example.com')
ORDER BY full_name;

-- Test validazione codice fiscale
SELECT 
  'Codice fiscale valido' as test,
  public.is_valid_cf('RSSMRA80A01H501U') as risultato
UNION ALL
SELECT 
  'Codice fiscale non valido' as test,
  public.is_valid_cf('INVALID') as risultato;

-- =====================================================
-- 10. VERIFICA BACKFILL PLAYERS
-- =====================================================

SELECT 'BACKFILL PLAYERS' as verifica;

-- Conta quanti players hanno person_id
SELECT 
  'Players con person_id' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE person_id IS NOT NULL

UNION ALL

SELECT 
  'Players senza person_id' as descrizione,
  COUNT(*) as totale
FROM public.players 
WHERE person_id IS NULL;

-- =====================================================
-- 11. VERIFICA BACKFILL PROFILES
-- =====================================================

SELECT 'BACKFILL PROFILES' as verifica;

-- Conta quanti profiles hanno person_id
SELECT 
  'Profiles con person_id' as descrizione,
  COUNT(*) as totale
FROM public.profiles 
WHERE person_id IS NOT NULL

UNION ALL

SELECT 
  'Profiles senza person_id' as descrizione,
  COUNT(*) as totale
FROM public.profiles 
WHERE person_id IS NULL;

-- =====================================================
-- 12. PULIZIA TEST
-- =====================================================

-- Rimuovi i record di test
DELETE FROM public.people 
WHERE email IN ('test.maggiorenne@example.com', 'test.minorenne@example.com');

-- =====================================================
-- VERIFICA COMPLETATA
-- =====================================================

SELECT 'VERIFICA COMPLETATA - Controlla i risultati sopra' as status;





