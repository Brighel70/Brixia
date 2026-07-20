-- =============================================================================
-- 010_accounting_foundation_test.sql
-- =============================================================================
-- Controlli READ-ONLY da eseguire DOPO aver applicato 010_accounting_foundation.sql
-- Solo SELECT. Non modifica dati, non disabilita RLS, non contiene credenziali.
-- =============================================================================

-- T1 — Esattamente le sei tabelle attese
SELECT
  'T1_table_count' AS check_id,
  COUNT(*) AS accounting_foundation_table_count,
  ARRAY_AGG(table_name ORDER BY table_name) AS table_names
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
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  )
ORDER BY c.relname;
-- Atteso: rls_enabled = true per tutte

-- T3 — Esattamente nove permessi accounting.*
SELECT
  'T3_permissions_count' AS check_id,
  COUNT(*) AS accounting_permission_count
FROM public.permissions
WHERE name LIKE 'accounting.%';
-- Atteso: 9

SELECT
  'T3b_permissions_list' AS check_id,
  name,
  category,
  position_order
FROM public.permissions
WHERE name LIKE 'accounting.%'
ORDER BY position_order, name;

-- T4 — Assegnazione ruolo: solo Admin (e conteggio)
SELECT
  'T4_role_grants' AS check_id,
  ur.name AS role_name,
  COUNT(*) AS accounting_permission_count
FROM public.role_permissions rp
JOIN public.user_roles ur ON ur.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.name LIKE 'accounting.%'
GROUP BY ur.name
ORDER BY ur.name;
-- Atteso: una sola riga Admin con count = 9

-- T4b — Eventuali grant a ruoli diversi da Admin
SELECT
  'T4b_non_admin_grants' AS check_id,
  ur.name AS role_name,
  p.name AS permission_name
FROM public.role_permissions rp
JOIN public.user_roles ur ON ur.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.name LIKE 'accounting.%'
  AND ur.name NOT ILIKE 'Admin'
ORDER BY ur.name, p.name;
-- Atteso: 0 righe

-- T5 — Conti
SELECT 'T5_accounts' AS check_id, code, name, kind, currency, is_active
FROM public.accounting_accounts
WHERE code IN ('CASSA', 'BANCA')
ORDER BY code;

-- T6 — Mapping metodi
SELECT
  'T6_method_map' AS check_id,
  m.source_system,
  m.raw_payment_method,
  m.normalized_method,
  a.code AS account_code
FROM public.accounting_payment_method_account_map m
JOIN public.accounting_accounts a ON a.id = m.account_id
ORDER BY m.raw_payment_method;

-- T7 — Categorie
SELECT
  'T7_categories' AS check_id,
  code, name, direction, default_nature, include_in_commercial_limit, is_system
FROM public.accounting_categories
WHERE code IN ('QUOTE', 'ALTRE_ENTRATE', 'ALTRE_USCITE')
ORDER BY sort_order, code;

-- T8 — Parametri fiscali: valid_from 2026-01-01 e unverified
SELECT
  'T8_fiscal_params' AS check_id,
  param_key,
  value_json,
  valid_from,
  verification_status,
  source,
  verification_note
FROM public.accounting_fiscal_params
ORDER BY param_key;
-- Atteso: valid_from = 2026-01-01, verification_status = unverified

-- T9 — Settings
SELECT
  'T9_settings' AS check_id,
  legal_form,
  default_currency,
  fiscal_regime,
  regime_398_active,
  params_verification_status
FROM public.accounting_settings;

-- T10 — Nessun esercizio auto-creato
SELECT 'T10_fiscal_years_count' AS check_id, COUNT(*) AS fiscal_years_count
FROM public.accounting_fiscal_years;

-- T11 — Quote: nessun trigger accounting
SELECT
  'T11_quote_triggers' AS check_id,
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
ORDER BY c.relname, t.tgname;
-- Atteso: solo update_*_updated_at / update_updated_at_column; nessuna funzione accounting_*

SELECT
  'T11b_quote_accounting_fn' AS check_id,
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
  AND p.proname LIKE 'accounting%';
-- Atteso: 0 righe

-- T12 — accounting_set_updated_at presente
SELECT
  'T12_accounting_set_updated_at' AS check_id,
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_set_updated_at';

-- T12b — Tutti i trigger updated_at accounting_* usano accounting_set_updated_at
SELECT
  'T12b_accounting_triggers' AS check_id,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname LIKE 'accounting_%'
ORDER BY c.relname, t.tgname;
-- Atteso: function_name = accounting_set_updated_at per i trg_*_updated_at

-- T12c — update_updated_at_column non risulta “nuova” definizione accounting-only:
-- (controllo presenza storica; la migration non deve averne creato una dedicata)
SELECT
  'T12c_shared_update_updated_at' AS check_id,
  p.proname,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_updated_at_column';
-- Nota: la funzione può esistere (Quote). La migration 010 non deve averla creata/sostituita
-- in modo dedicato Contabilità; i trigger accounting_* non devono usarla.

-- T13 — FK accounting_* → profiles: delete rule SET NULL
SELECT
  'T13_fk_profiles_delete_rule' AS check_id,
  tc.table_name AS from_table,
  kcu.column_name AS from_column,
  ccu.table_name AS to_table,
  ccu.column_name AS to_column,
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
  AND tc.table_name LIKE 'accounting_%'
  AND ccu.table_name = 'profiles'
ORDER BY tc.table_name, kcu.column_name;
-- Atteso: delete_rule = SET NULL per tutte

-- T14 — has_accounting_permission: SECURITY DEFINER + privilegi EXECUTE
SELECT
  'T14_has_accounting_permission' AS check_id,
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'has_accounting_permission';

SELECT
  'T14b_execute_grants' AS check_id,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'has_accounting_permission'
ORDER BY grantee, privilege_type;

SELECT
  'T14c_public_execute' AS check_id,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'has_accounting_permission'
  AND grantee = 'PUBLIC';
-- Atteso T14c: 0 righe

-- T15 — Policy accounting_fiscal_years (USING / WITH CHECK)
SELECT
  'T15_fiscal_years_policies' AS check_id,
  policyname,
  cmd,
  roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_fiscal_years'
ORDER BY policyname, cmd;

-- T16 — Nessuna policy DELETE su accounting_*
SELECT
  'T16_delete_policies' AS check_id,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'accounting_%'
  AND cmd = 'DELETE';
-- Atteso: 0 righe

-- T17 — authenticated: soltanto SELECT, INSERT, UPDATE (A)
SELECT
  'T17_table_grants_authenticated' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  )
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso: solo SELECT, INSERT, UPDATE (18 righe = 6 tabelle × 3)

-- T17b — authenticated NON deve avere DELETE/TRUNCATE/REFERENCES/TRIGGER (B)
SELECT
  'T17b_authenticated_forbidden_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  )
  AND grantee = 'authenticated'
  AND privilege_type IN ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER')
ORDER BY table_name, privilege_type;
-- Atteso: 0 righe

-- T18 — Nessuna policy anon/public
SELECT
  'T18_anon_policies' AS check_id,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'accounting_%'
  AND (
    roles::text ILIKE '%anon%'
    OR roles::text ILIKE '%public%'
  );
-- Atteso: 0 righe

-- T19 — anon senza privilegi sulle sei tabelle foundation (C)
SELECT
  'T19_anon_table_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  )
  AND grantee = 'anon'
ORDER BY table_name, privilege_type;
-- Atteso: 0 righe

-- T20 — PUBLIC senza privilegi sulle sei tabelle foundation (D)
SELECT
  'T20_public_table_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  )
  AND grantee = 'PUBLIC'
ORDER BY table_name, privilege_type;
-- Atteso: 0 righe

-- T21 — search_path / proconfig delle funzioni Contabilità
SELECT
  'T21_function_search_path' AS check_id,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.proconfig AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('accounting_set_updated_at', 'has_accounting_permission')
ORDER BY p.proname;
-- Atteso: proconfig contiene search_path=pg_catalog, public

-- T22 — EXECUTE funzioni: anon assente (E)
SELECT
  'T22_anon_function_execute' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN ('has_accounting_permission', 'accounting_set_updated_at')
  AND grantee = 'anon'
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name;
-- Atteso: 0 righe

-- T22b — EXECUTE funzioni: PUBLIC assente (F)
SELECT
  'T22b_public_function_execute' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN ('has_accounting_permission', 'accounting_set_updated_at')
  AND grantee = 'PUBLIC'
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name;
-- Atteso: 0 righe

-- T22c — EXECUTE funzioni: authenticated presente su entrambe (G)
SELECT
  'T22c_authenticated_function_execute' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN ('has_accounting_permission', 'accounting_set_updated_at')
  AND grantee = 'authenticated'
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name;
-- Atteso: 2 righe (una per funzione)

-- T22d — service_role: privilegi tabella ALL / EXECUTE funzioni (H)
SELECT
  'T22d_service_role_table_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_settings',
    'accounting_fiscal_params',
    'accounting_fiscal_years',
    'accounting_accounts',
    'accounting_categories',
    'accounting_payment_method_account_map'
  )
  AND grantee = 'service_role'
ORDER BY table_name, privilege_type;
-- Atteso: privilegi completi (ALL) sulle 6 tabelle

SELECT
  'T22e_service_role_function_execute' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN ('has_accounting_permission', 'accounting_set_updated_at')
  AND grantee = 'service_role'
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name;
-- Atteso: 2 righe EXECUTE

-- =============================================================================
-- Query diagnostica OPZIONALE (se serve confermare schema permessi live)
-- Eseguire SOLO se richiesto; resta read-only.
-- =============================================================================
-- SELECT 'PERM_COLS' AS section, table_name, column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('permissions', 'role_permissions', 'user_permissions', 'user_roles', 'profiles')
-- ORDER BY table_name, ordinal_position;
-- =============================================================================

