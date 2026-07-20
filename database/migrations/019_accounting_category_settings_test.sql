-- =============================================================================
-- 019_accounting_category_settings_test.sql
-- =============================================================================
-- Test statici post-apply 019 category settings (SQL Editor).
-- NON applicare 019 da questo file. Solo SELECT / metadati — nessun write persistente.
--
-- T1–T20: tabelle, colonne, unique, indici, RLS, grant, seed QUOTE, funzioni.
-- =============================================================================

-- T1 — tabella gruppi presente
SELECT 'T1_groups_table' AS check_id,
  to_regclass('public.accounting_category_groups') IS NOT NULL AS ok;

-- T2 — colonne chiave groups
SELECT 'T2_groups_columns' AS check_id,
  COUNT(*) FILTER (WHERE column_name IN (
    'id', 'direction', 'code', 'name', 'description',
    'is_active', 'is_system', 'sort_order',
    'created_at', 'created_by', 'updated_at', 'updated_by',
    'archived_at', 'archived_by'
  )) AS matched_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_category_groups';
-- Atteso: 14

-- T3 — colonne nuove su accounting_categories
SELECT 'T3_categories_new_columns' AS check_id,
  COUNT(*) FILTER (WHERE column_name IN (
    'group_id',
    'available_in_movements',
    'available_in_budget',
    'available_in_reports',
    'recommended_active'
  )) AS matched_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_categories';
-- Atteso: 5

-- T4 — UNIQUE (direction, code) su groups
SELECT 'T4_groups_unique' AS check_id,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_category_groups_direction_code_unique'
      AND conrelid = 'public.accounting_category_groups'::regclass
  ) AS ok;

-- T5 — CHECK direction income|expense (non both)
SELECT 'T5_groups_direction_check' AS check_id,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.accounting_category_groups'::regclass
  AND c.contype = 'c'
  AND pg_get_constraintdef(c.oid) ILIKE '%income%expense%';

-- T6 — FK group_id → groups ON DELETE RESTRICT
SELECT 'T6_group_id_fk' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
      AND rel.relname = 'accounting_categories'
      AND c.contype = 'f'
      AND pg_get_constraintdef(c.oid) ILIKE '%group_id%'
      AND pg_get_constraintdef(c.oid) ILIKE '%accounting_category_groups%'
      AND pg_get_constraintdef(c.oid) ILIKE '%RESTRICT%'
  ) AS ok;

-- T7 — indici groups + group_id
SELECT 'T7_indexes' AS check_id,
  COUNT(*) FILTER (WHERE indexname IN (
    'idx_accounting_category_groups_direction',
    'idx_accounting_category_groups_is_active',
    'idx_accounting_category_groups_sort_order',
    'idx_accounting_categories_group_id'
  )) AS matched_indexes
FROM pg_indexes
WHERE schemaname = 'public';
-- Atteso: 4

-- T8 — trigger updated_at su groups
SELECT 'T8_trg_groups_updated_at' AS check_id,
  t.tgname,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_category_groups'
  AND t.tgname = 'trg_accounting_category_groups_updated_at'
  AND NOT t.tgisinternal;

-- T9 — trigger protect groups
SELECT 'T9_trg_groups_protect' AS check_id,
  t.tgname,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_category_groups'
  AND t.tgname = 'trg_accounting_category_groups_protect'
  AND NOT t.tgisinternal;

-- T10 — trigger coerenza categorie
SELECT 'T10_trg_category_coherence' AS check_id,
  t.tgname,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_categories'
  AND t.tgname = 'trg_accounting_category_enforce_group_coherence'
  AND NOT t.tgisinternal;

-- T11 — RLS enabled
SELECT 'T11_rls' AS check_id,
  c.relname,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('accounting_category_groups', 'accounting_categories')
ORDER BY c.relname;

-- T12 — anon senza privilegi tabella
SELECT 'T12_anon_privs' AS check_id,
  COUNT(*) AS anon_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('accounting_category_groups', 'accounting_categories')
  AND grantee = 'anon';
-- Atteso: 0

-- T13 — authenticated: SELECT/INSERT/UPDATE, no DELETE
SELECT 'T13_authenticated_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('accounting_category_groups', 'accounting_categories')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso: SELECT, INSERT, UPDATE per entrambe; nessun DELETE

-- T14 — policy SELECT/INSERT/UPDATE presenti; nessun DELETE policy
SELECT 'T14_policies' AS check_id,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('accounting_category_groups', 'accounting_categories')
ORDER BY tablename, policyname;

SELECT 'T14b_no_delete_policy' AS check_id,
  COUNT(*) AS delete_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('accounting_category_groups', 'accounting_categories')
  AND cmd = 'DELETE';
-- Atteso: 0

-- T15 — QUOTE esiste ancora (id/code preservati) e mappata a QUOTE_SPORT
SELECT 'T15_quote_mapping' AS check_id,
  c.id,
  c.code,
  c.is_active,
  c.is_system,
  c.direction,
  c.default_nature,
  c.include_in_commercial_limit,
  c.recommended_active,
  c.available_in_movements,
  c.available_in_budget,
  c.available_in_reports,
  g.code AS group_code,
  g.direction AS group_direction
FROM public.accounting_categories c
LEFT JOIN public.accounting_category_groups g ON g.id = c.group_id
WHERE upper(c.code) = 'QUOTE';
-- Atteso: 1 riga, group_code=QUOTE_SPORT, is_active=true, recommended_active=true

-- T16 — seed gruppi di sistema (11 attesi)
SELECT 'T16_system_groups' AS check_id,
  COUNT(*) AS system_groups
FROM public.accounting_category_groups
WHERE is_system IS TRUE;
-- Atteso: 11

SELECT 'T16b_group_codes' AS check_id,
  direction,
  code,
  sort_order
FROM public.accounting_category_groups
WHERE is_system IS TRUE
ORDER BY direction, sort_order, code;

-- T17 — ALTRE_ENTRATE / ALTRE_USCITE mappate; SPONSOR o SPONSORIZZAZIONI senza duplicato
SELECT 'T17_legacy_map' AS check_id,
  c.code,
  g.code AS group_code
FROM public.accounting_categories c
LEFT JOIN public.accounting_category_groups g ON g.id = c.group_id
WHERE upper(c.code) IN ('ALTRE_ENTRATE', 'ALTRE_USCITE', 'SPONSOR', 'SPONSORIZZAZIONI')
ORDER BY c.code;

SELECT 'T17b_sponsor_no_dup' AS check_id,
  COUNT(*) FILTER (WHERE upper(code) = 'SPONSOR') AS sponsor_n,
  COUNT(*) FILTER (WHERE upper(code) = 'SPONSORIZZAZIONI') AS sponsorizzazioni_n
FROM public.accounting_categories;
-- Atteso: al più uno tra SPONSOR e SPONSORIZZAZIONI presente come “sponsor primario”
-- (possono coesistere solo se SPONSOR pre-esisteva e SPONSORIZZAZIONI non è stato creato)

-- T18 — funzioni RPC / helper esistono + SECURITY DEFINER dove previsto
SELECT 'T18_functions' AS check_id,
  p.proname,
  p.prosecdef AS security_definer,
  (
    SELECT string_agg(cfg, ',')
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
  ) AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'accounting_category_enforce_group_coherence',
    'accounting_category_groups_protect',
    'accounting_category_group_id_by_code',
    'accounting_normalize_category_code',
    'accounting_categories_save_activation_batch',
    'accounting_category_group_create',
    'accounting_category_group_update',
    'accounting_category_create',
    'accounting_category_update',
    'accounting_recommended_activation_reset'
  )
ORDER BY p.proname;
-- Atteso: 10 funzioni

-- T19 — EXECUTE RPC non a anon/PUBLIC; trigger helpers ok
SELECT 'T19_fn_execute_anon' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_categories_save_activation_batch',
    'accounting_category_group_create',
    'accounting_category_group_update',
    'accounting_category_create',
    'accounting_category_update',
    'accounting_recommended_activation_reset'
  )
  AND grantee IN ('anon', 'PUBLIC')
ORDER BY routine_name, grantee;
-- Atteso: 0 righe

-- T20 — recommended_active popolato; demo catalogo attivo/inattivo
SELECT 'T20_recommended_active_col' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_categories'
      AND column_name = 'recommended_active'
  ) AS ok;

SELECT 'T20b_catalog_sample' AS check_id,
  code,
  is_active,
  recommended_active,
  default_nature,
  include_in_commercial_limit
FROM public.accounting_categories
WHERE upper(code) IN (
  'QUOTE', 'PUBBLICITA', 'BIGLIETTERIA', 'MATERIALE_SPORTIVO',
  'MERCHANDISING', 'ARBITRI', 'AMMORTAMENTI'
)
ORDER BY code;
-- Demo read-only: QUOTE/PUBBLICITA attive consigliate; MERCHANDISING/ARBITRI inactive
