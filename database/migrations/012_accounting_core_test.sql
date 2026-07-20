-- =============================================================================
-- 012_accounting_core_test.sql
-- =============================================================================
-- Controlli READ-ONLY da eseguire DOPO 012_accounting_core.sql (revisione)
-- Solo SELECT. Nessun dato personale / ID utente / email / password / token.
-- =============================================================================

-- T1 — Esistenza esatta delle sei nuove tabelle core
SELECT
  'T1_core_tables' AS check_id,
  COUNT(*) AS core_table_count,
  ARRAY_AGG(table_name ORDER BY table_name) AS table_names
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  );
-- Atteso: count = 6

-- T2 — RLS attiva su tutte e sei
SELECT
  'T2_rls' AS check_id,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
ORDER BY c.relname;
-- Atteso: rls_enabled = true per tutte

-- T3 — anon senza privilegi sulle sei tabelle core
SELECT
  'T3_anon_table_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND grantee = 'anon'
ORDER BY table_name, privilege_type;
-- Atteso: 0 righe

-- T4 — PUBLIC senza privilegi sulle sei tabelle core
SELECT
  'T4_public_table_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND grantee = 'PUBLIC'
ORDER BY table_name, privilege_type;
-- Atteso: 0 righe

-- T5 — privilegi authenticated per tabella
SELECT
  'T5_authenticated_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso:
-- counterparties: INSERT, SELECT, UPDATE
-- receivables: SELECT
-- movements: INSERT, SELECT, UPDATE (nessun DELETE)
-- allocations: DELETE, INSERT, SELECT, UPDATE
-- source_links: SELECT
-- audit_log: SELECT

-- T5b — privilegi vietati authenticated
SELECT
  'T5b_authenticated_forbidden' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND (
    (table_name = 'accounting_counterparties'
      AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE'))
    OR (table_name = 'accounting_receivables'
      AND privilege_type <> 'SELECT')
    OR (table_name = 'accounting_movements'
      AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE'))
    OR (table_name = 'accounting_movement_allocations'
      AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'accounting_source_links'
      AND privilege_type <> 'SELECT')
    OR (table_name = 'accounting_audit_log'
      AND privilege_type <> 'SELECT')
  )
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso: 0 righe

-- T5c — movements: nessun GRANT DELETE
SELECT
  'T5c_movements_no_delete_grant' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'accounting_movements'
  AND grantee = 'authenticated'
  AND privilege_type = 'DELETE';
-- Atteso: 0 righe

-- T6 — nessuna policy anon/public
SELECT
  'T6_anon_policies' AS check_id,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND (
    roles::text ILIKE '%anon%'
    OR roles::text ILIKE '%public%'
  );
-- Atteso: 0 righe

-- T7 — policy DELETE: solo allocations
SELECT
  'T7_delete_policies' AS check_id,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND cmd = 'DELETE'
ORDER BY tablename, policyname;
-- Atteso: solo accounting_movement_allocations

-- T7b — movements: nessuna policy DELETE
SELECT
  'T7b_movements_no_delete_policy' AS check_id,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_movements'
  AND cmd = 'DELETE';
-- Atteso: 0 righe

-- T8 — FK verso profiles: delete_rule SET NULL
SELECT
  'T8_fk_profiles_set_null' AS check_id,
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_name = kcu.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND ccu.table_name = 'profiles'
ORDER BY tc.table_name, kcu.column_name;
-- Atteso: delete_rule = SET NULL per tutte

-- T9 — nessuna FK verso Quote / people3
SELECT
  'T9_no_quote_fk' AS check_id,
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_name = kcu.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
  AND ccu.table_name IN ('fees', 'fee_assignments', 'payments', 'payment_receipts', 'people3')
ORDER BY tc.table_name, kcu.column_name;
-- Atteso: 0 righe

-- T10 — FK verso people / categories / events
SELECT
  'T10_fk_people_categories_events' AS check_id,
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_name = kcu.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movement_allocations'
  )
  AND ccu.table_name IN ('people', 'categories', 'events')
ORDER BY tc.table_name, kcu.column_name;

-- T11 — unique receivables source + source_links (link_type)
SELECT
  'T11_source_uniques' AS check_id,
  c.relname AS index_or_table,
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS index_def
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('accounting_receivables', 'accounting_source_links')
  AND x.indisunique
  AND (
    i.relname ILIKE '%source%'
    OR pg_get_indexdef(i.oid) ILIKE '%source_system%'
    OR pg_get_indexdef(i.oid) ILIKE '%link_type%'
  )
ORDER BY c.relname, i.relname;

-- T11b — source_links UNIQUE include link_type; assenza source_event_type
SELECT
  'T11b_source_links_columns' AS check_id,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_source_links'
  AND column_name IN ('link_type', 'source_event_type', 'source_system', 'source_table', 'source_id')
ORDER BY column_name;
-- Atteso: link_type presente; source_event_type assente

-- T11c — CHECK link_type / target coherence
SELECT
  'T11c_source_links_checks' AS check_id,
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.accounting_source_links'::regclass
  AND c.contype = 'c'
ORDER BY c.conname;

-- T12 — vincoli importi
SELECT
  'T12_amount_checks' AS check_id,
  c.conrelid::regclass AS table_name,
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'c'
  AND c.conrelid IN (
    'public.accounting_receivables'::regclass,
    'public.accounting_movements'::regclass,
    'public.accounting_movement_allocations'::regclass
  )
  AND (
    pg_get_constraintdef(c.oid) ILIKE '%amount%'
    OR pg_get_constraintdef(c.oid) ILIKE '%refund%'
    OR pg_get_constraintdef(c.oid) ILIKE '%percentage%'
  )
ORDER BY c.conrelid::regclass::text, c.conname;

-- T13 — residual GENERATED STORED
SELECT
  'T13_residual_generated' AS check_id,
  a.attname AS column_name,
  a.attgenerated AS generated_kind,
  pg_get_expr(ad.adbin, ad.adrelid) AS generation_expression
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_receivables'
  AND a.attname = 'residual_amount_cents'
  AND NOT a.attisdropped;
-- Atteso: generated_kind = 's'

-- T14 — zero seed
SELECT 'T14_seed_counterparties' AS check_id, COUNT(*) AS row_count
FROM public.accounting_counterparties;
SELECT 'T14_seed_receivables' AS check_id, COUNT(*) AS row_count
FROM public.accounting_receivables;
SELECT 'T14_seed_movements' AS check_id, COUNT(*) AS row_count
FROM public.accounting_movements;
SELECT 'T14_seed_allocations' AS check_id, COUNT(*) AS row_count
FROM public.accounting_movement_allocations;
SELECT 'T14_seed_source_links' AS check_id, COUNT(*) AS row_count
FROM public.accounting_source_links;
SELECT 'T14_seed_audit_log' AS check_id, COUNT(*) AS row_count
FROM public.accounting_audit_log;
-- Atteso: 0 per tutte

-- T15 — nessun trigger accounting sulle Quote
SELECT
  'T15_quote_accounting_triggers' AS check_id,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN ('fees', 'fee_assignments', 'payments', 'payment_receipts')
  AND (
    p.proname LIKE 'accounting%'
    OR t.tgname ILIKE '%accounting%'
  );
-- Atteso: 0 righe

-- T16 — trigger sulle tabelle core
SELECT
  'T16_core_triggers' AS check_id,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN (
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  )
ORDER BY c.relname, t.tgname;
-- Atteso: nessun accounting_protect_movement_immutability

-- T16b — assenza funzione/trigger immutabilità movements
SELECT
  'T16b_no_movement_immutability_fn' AS check_id,
  p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_protect_movement_immutability';
-- Atteso: 0 righe

SELECT
  'T16c_no_movement_immutability_trg' AS check_id,
  t.tgname AS trigger_name
FROM pg_trigger AS t
JOIN pg_class AS rel ON rel.oid = t.tgrelid
JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
WHERE NOT t.tgisinternal
  AND nsp.nspname = 'public'
  AND rel.relname = 'accounting_movements'
  AND t.tgname = 'trg_accounting_movements_immutability';
-- Atteso: 0 righe

-- T17 — audit: nessuna policy INSERT/UPDATE/DELETE
SELECT
  'T17_audit_write_policies' AS check_id,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_audit_log'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
-- Atteso: 0 righe

-- T17b — audit: authenticated senza INSERT/UPDATE/DELETE
SELECT
  'T17b_audit_authenticated_grants' AS check_id,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'accounting_audit_log'
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
-- Atteso: 0 righe

-- T17c — audit append-only function presente
SELECT
  'T17c_audit_append_only_fn' AS check_id,
  p.proname,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_protect_audit_append_only';

-- T18 — movements INSERT/UPDATE: espressioni USING e WITH CHECK
SELECT
  'T18_movements_policies' AS check_id,
  policyname,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_movements'
ORDER BY cmd, policyname;
-- Atteso INSERT with_check: create + draft/pending
-- Atteso UPDATE using+with_check: edit_draft + draft/pending

-- T18b — nessuna policy UPDATE movements senza draft/pending
SELECT
  'T18b_movements_admin_bypass_posted' AS check_id,
  policyname,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_movements'
  AND cmd = 'UPDATE'
  AND (
    (qual IS NOT NULL AND qual NOT ILIKE '%draft%' AND qual NOT ILIKE '%pending_account%')
    OR (with_check IS NOT NULL AND with_check NOT ILIKE '%draft%' AND with_check NOT ILIKE '%pending_account%')
  );
-- Atteso: 0 righe

-- T19 — source_links senza scrittura authenticated (policy)
SELECT
  'T19_source_links_write_policies' AS check_id,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_source_links'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
-- Atteso: 0 righe

-- T20 — receivables senza scrittura authenticated (policy)
SELECT
  'T20_receivables_write_policies' AS check_id,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_receivables'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
-- Atteso: 0 righe

-- T21 — foundation 010/011 intatta
SELECT
  'T21_foundation_tables_intact' AS check_id,
  COUNT(*) AS foundation_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  );
-- Atteso: 6

-- T22 — funzioni protezione (forbid delete + audit; NON immutability movements)
SELECT
  'T22_protect_functions' AS check_id,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.proconfig AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'accounting_forbid_physical_delete',
    'accounting_protect_audit_append_only'
  )
ORDER BY p.proname;

-- T23 — unique parziale people_id su counterparties
SELECT
  'T23_counterparties_people_unique' AS check_id,
  i.relname AS index_name,
  pg_get_indexdef(i.oid) AS index_def
FROM pg_index x
JOIN pg_class i ON i.oid = x.indexrelid
JOIN pg_class c ON c.oid = x.indrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_counterparties'
  AND x.indisunique
  AND pg_get_indexdef(i.oid) ILIKE '%people_id%';

-- T24 — policy allocations DELETE restrittiva (bozze)
SELECT
  'T24_allocations_delete_policy' AS check_id,
  policyname,
  cmd,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_movement_allocations'
  AND cmd = 'DELETE';
-- Atteso: 1 policy con edit_draft + draft/pending_account

-- T25 — self-FK movements su accounting_movements (conrelid corretto)
SELECT
  'T25_movements_self_fk' AS check_id,
  c.conname,
  c.conrelid::regclass AS on_table,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.accounting_movements'::regclass
  AND c.contype = 'f'
  AND c.conname IN (
    'accounting_movements_reverses_fk',
    'accounting_movements_reversed_by_fk'
  )
ORDER BY c.conname;
