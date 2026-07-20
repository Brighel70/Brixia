-- =============================================================================
-- 018_accounting_commercial_vat_test.sql
-- =============================================================================
-- Test statici post-apply 018 commercial VAT (SQL Editor).
-- NON applicare 018 da questo file. Solo SELECT strutturali + formula helper.
--
-- Formula demo (puro commento, nessuna INSERT business):
--   imponibile 1_000_000 cent × 2200 bp (22,00%) → IVA 220_000
--   forfait 50% su IVA → 110_000
--   IVA stimata dovuta → 110_000
--   (half_up_cent: round(1000000 * 2200 / 10000) = 220000)
--
-- Chiavi fiscali 010 (documentate, non inventate):
--   commercial_revenue_limit
--   vat_flat_deduction_pct
--   vat_periodicity
--   vat_rate_sponsorship
--   vat_rounding_method
--
-- Momento impositivo: document_date (ipotesi gestionale; conferma commercialista).
--
-- -----------------------------------------------------------------------------
-- Scenari WRITE (COMMENT — non eseguiti; restano separati dai SELECT):
--
--   S1 FULL: documento gross=1000; register_payment 1000 → collected; movement_id NULL.
--   S2 TWO PARTIALS: register 400 → partially_collected; register 600 → collected.
--   S3 ONE MOV TWO DOCS: link docA 400 + docB 600 OK; oltre amount bloccato.
--   S4 OVER-ALLOC: oltre residual doc o amount mov → raise; UNIQUE(doc,mov).
--   S5 REVERSE: posted→reversed → collected scende; refresh status.
--
--   S6 ISSUE INVOICE: document_type=invoice senza number → raise; resta draft.
--   S7 ISSUE DUP: due draft stesso FY+type+number → seconda issue raise.
--   S8 ISSUE VAT: vat_amount != accounting_vat_from_taxable → raise; resta draft.
--   S9 ISSUE RATE OVERRIDE: bp ≠ proposto senza manage_settings → raise.
--   S10 CANCEL: issued con collected>0 → raise; partially_collected → raise;
--       draft con edit_draft OK; issued senza incassi con post OK.
--   S11 REGISTER: account is_active=false / FY closed / date fuori FY → raise.
--   S12 LINK: movement non posted / non income → raise.
-- -----------------------------------------------------------------------------
-- T1–T35: SELECT strutturali / privilegi / vincoli. Nessuna INSERT business.
-- =============================================================================

-- T1 — tabelle presenti
SELECT 'T1_tables' AS check_id,
  to_regclass('public.accounting_commercial_documents') IS NOT NULL AS documents_ok,
  to_regclass('public.accounting_commercial_document_payments') IS NOT NULL AS payments_ok,
  to_regclass('public.accounting_vat_periods') IS NOT NULL AS vat_periods_ok;
-- Atteso: documents_ok, payments_ok, vat_periods_ok = true

-- T2 — colonne chiave commercial_documents
SELECT 'T2_doc_columns' AS check_id,
  COUNT(*) FILTER (WHERE column_name IN (
    'id', 'fiscal_year_id', 'counterparty_id', 'document_type', 'document_number',
    'document_date', 'description', 'commercial_kind',
    'taxable_amount_cents', 'vat_rate_basis_points', 'vat_amount_cents',
    'gross_amount_cents', 'status', 'movement_id', 'include_in_398_limit',
    'notes', 'issued_at', 'issued_by', 'collected_at', 'collected_by',
    'cancelled_at', 'cancelled_by', 'created_at', 'created_by',
    'updated_at', 'updated_by'
  )) AS matched_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_commercial_documents';
-- Atteso: 26

-- T3 — colonne chiave payments
SELECT 'T3_payment_columns' AS check_id,
  COUNT(*) FILTER (WHERE column_name IN (
    'id', 'document_id', 'movement_id', 'allocated_amount_cents',
    'notes', 'created_at', 'created_by'
  )) AS matched_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_commercial_document_payments';
-- Atteso: 7

-- T4 — colonne chiave vat_periods
SELECT 'T4_vat_columns' AS check_id,
  COUNT(*) FILTER (WHERE column_name IN (
    'id', 'fiscal_year_id', 'year', 'quarter', 'status',
    'commercial_taxable_cents', 'output_vat_cents', 'forfait_deduction_cents',
    'estimated_vat_due_cents', 'indicative_due_on',
    'verified_at', 'verified_by', 'paid_at', 'payment_reference',
    'param_snapshot', 'created_at', 'created_by', 'updated_at', 'updated_by'
  )) AS matched_cols
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_vat_periods';
-- Atteso: 19

-- T5 — status documents include partially_collected
SELECT 'T5_status_partially_collected' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%partially_collected%'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  ) AS ok;
-- Atteso: ok = true

-- T6 — CHECK gross = taxable + vat
SELECT 'T6_gross_check' AS check_id,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_commercial_documents_gross_equals_parts'
      AND conrelid = 'public.accounting_commercial_documents'::regclass
  ) AS ok;

-- T7 — UNIQUE (document_id, movement_id) su payments
SELECT 'T7_payments_unique' AS check_id,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_commercial_document_payments_doc_mov_unique'
      AND conrelid = 'public.accounting_commercial_document_payments'::regclass
  ) AS ok;

-- T8 — UNIQUE (fiscal_year_id, year, quarter) vat_periods
SELECT 'T8_vat_unique' AS check_id,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_vat_periods_fy_year_quarter_unique'
      AND conrelid = 'public.accounting_vat_periods'::regclass
  ) AS ok;

-- T9 — NESSUN unique index legacy su documents.movement_id
SELECT 'T9_no_legacy_movement_unique' AS check_id,
  NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_accounting_commercial_documents_movement'
  ) AS ok;
-- Atteso: ok = true (unique droppato; colonna legacy nullable inutilizzata)

-- T10 — indici documents + payments
SELECT 'T10_indexes' AS check_id,
  (
    SELECT COUNT(*) FILTER (WHERE indexname IN (
      'idx_accounting_commercial_documents_fiscal_year',
      'idx_accounting_commercial_documents_document_date',
      'idx_accounting_commercial_documents_status',
      'idx_accounting_commercial_documents_commercial_kind',
      'idx_accounting_commercial_documents_counterparty'
    ))
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'accounting_commercial_documents'
  ) AS doc_indexes,
  (
    SELECT COUNT(*) FILTER (WHERE indexname IN (
      'idx_accounting_commercial_document_payments_document',
      'idx_accounting_commercial_document_payments_movement'
    ))
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'accounting_commercial_document_payments'
  ) AS payment_indexes;
-- Atteso: doc_indexes=5, payment_indexes=2

-- T11 — RLS abilitato su 3 tabelle
SELECT 'T11_rls' AS check_id,
  c.relname,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'accounting_commercial_documents',
    'accounting_commercial_document_payments',
    'accounting_vat_periods'
  )
ORDER BY c.relname;
-- Atteso: rls_enabled = true per tutte e 3

-- T12 — policy presenti
SELECT 'T12_policies' AS check_id,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'accounting_commercial_documents',
    'accounting_commercial_document_payments',
    'accounting_vat_periods'
  )
ORDER BY tablename, policyname;
-- Atteso: documents select/insert/update_draft; payments select only; vat select only

-- T13 — anon senza privilegi tabella
SELECT 'T13_anon_table_privs' AS check_id,
  COUNT(*) AS anon_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_commercial_documents',
    'accounting_commercial_document_payments',
    'accounting_vat_periods'
  )
  AND grantee = 'anon';
-- Atteso: 0

-- T14 — authenticated grants: SELECT su tutte; INSERT/UPDATE solo documents; payments solo SELECT
SELECT 'T14_authenticated_grants' AS check_id,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_commercial_documents',
    'accounting_commercial_document_payments',
    'accounting_vat_periods'
  )
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;
-- Atteso: documents SELECT+INSERT+UPDATE; payments SELECT; vat SELECT; nessun DELETE

-- T15 — funzioni presenti (incl. helpers pagamento + nuove RPC)
SELECT 'T15_functions' AS check_id,
  COUNT(*) FILTER (WHERE p.proname IN (
    'accounting_fiscal_param_resolve',
    'accounting_round_half_up_cents',
    'accounting_vat_from_taxable',
    'accounting_vat_indicative_due_on',
    'accounting_commercial_payment_is_effective',
    'accounting_commercial_doc_collected_cents',
    'accounting_commercial_movement_allocated_cents',
    'accounting_commercial_doc_refresh_collection_status',
    'accounting_commercial_documents_immutability',
    'accounting_vat_periods_immutability',
    'accounting_commercial_doc_issue',
    'accounting_commercial_doc_cancel',
    'accounting_commercial_doc_register_payment',
    'accounting_commercial_doc_link_movement',
    'accounting_vat_period_calculate',
    'accounting_vat_period_verify',
    'accounting_vat_period_mark_paid'
  )) AS matched_fns,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accounting_commercial_doc_collect'
  ) AS legacy_collect_still_exists
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';
-- Atteso: matched_fns = 17; legacy_collect_still_exists = false

-- T16 — SECURITY DEFINER + search_path sulle RPC pubbliche
SELECT 'T16_rpc_security' AS check_id,
  p.proname,
  p.prosecdef AS security_definer,
  (
    SELECT string_agg(cfg, ',' ORDER BY cfg)
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
  ) AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'accounting_commercial_doc_issue',
    'accounting_commercial_doc_cancel',
    'accounting_commercial_doc_register_payment',
    'accounting_commercial_doc_link_movement',
    'accounting_vat_period_calculate',
    'accounting_vat_period_verify',
    'accounting_vat_period_mark_paid'
  )
ORDER BY p.proname;
-- Atteso: security_definer=true; search_path=pg_catalog, public

-- T17 — EXECUTE non a anon/PUBLIC (RPC + helper)
SELECT 'T17_fn_execute_anon' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_fiscal_param_resolve',
    'accounting_vat_from_taxable',
    'accounting_commercial_doc_issue',
    'accounting_commercial_doc_cancel',
    'accounting_commercial_doc_register_payment',
    'accounting_commercial_doc_link_movement',
    'accounting_vat_period_calculate',
    'accounting_vat_period_verify',
    'accounting_vat_period_mark_paid'
  )
  AND grantee IN ('anon', 'PUBLIC')
ORDER BY routine_name, grantee;
-- Atteso: 0 righe

-- T18 — trigger updated_at + immutabilità + payments + movement status
SELECT 'T18_triggers' AS check_id,
  c.relname AS table_name,
  t.tgname,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND (
    (
      c.relname IN (
        'accounting_commercial_documents',
        'accounting_vat_periods'
      )
      AND t.tgname IN (
        'trg_accounting_commercial_documents_updated_at',
        'trg_accounting_commercial_documents_immutability',
        'trg_accounting_vat_periods_updated_at',
        'trg_accounting_vat_periods_immutability'
      )
    )
    OR (
      c.relname = 'accounting_commercial_document_payments'
      AND t.tgname IN (
        'trg_accounting_commercial_document_payments_validate',
        'trg_accounting_commercial_document_payments_after'
      )
    )
    OR (
      c.relname = 'accounting_movements'
      AND t.tgname = 'trg_accounting_commercial_payments_on_movement_status'
    )
  )
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
-- Atteso: 7 righe

-- T19 — categoria SPONSOR (o già SPONSORIZZAZIONI)
SELECT 'T19_sponsor_category' AS check_id,
  code,
  name,
  direction,
  default_nature,
  include_in_commercial_limit,
  is_system,
  sort_order
FROM public.accounting_categories
WHERE upper(code) IN ('SPONSOR', 'SPONSORIZZAZIONI')
ORDER BY CASE WHEN upper(code) = 'SPONSOR' THEN 0 ELSE 1 END;
-- Atteso: almeno 1 riga; se SPONSOR: direction=income; default_nature=commercial;
--         include_in_commercial_limit=true; is_system=true; sort_order=15

-- T20 — helper arrotondamento / IVA (formula demo 1000000 / 2200bp / 50%)
SELECT 'T20_vat_math' AS check_id,
  public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent') AS vat_cents,
  public.accounting_round_half_up_cents(
    (220000::numeric * 50) / 100.0
  ) AS forfait_cents,
  GREATEST(
    0,
    220000 - public.accounting_round_half_up_cents((220000::numeric * 50) / 100.0)
  ) AS due_cents;
-- Atteso: vat=220000, forfait=110000, due=110000

-- T21 — scadenze indicative
SELECT 'T21_indicative_due' AS check_id,
  public.accounting_vat_indicative_due_on(2026, 1) AS q1,
  public.accounting_vat_indicative_due_on(2026, 2) AS q2,
  public.accounting_vat_indicative_due_on(2026, 3) AS q3,
  public.accounting_vat_indicative_due_on(2026, 4) AS q4;
-- Atteso: 2026-05-16, 2026-08-20, 2026-11-16, 2027-02-16

-- T22 — document_type / commercial_kind / status CHECK esistono
SELECT 'T22_doc_checks' AS check_id,
  COUNT(*) FILTER (WHERE contype = 'c') AS named_checks
FROM pg_constraint
WHERE conrelid = 'public.accounting_commercial_documents'::regclass;
-- Atteso: >= 5 (description, document_type, commercial_kind, amounts, status, bp, …)

-- T23 — vat_periods quarter CHECK 1..4
SELECT 'T23_quarter_check' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.accounting_vat_periods'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%quarter%'
  ) AS ok;

-- T24 — chiavi fiscali 010 documentate (seed presenti o almeno nomi attesi)
SELECT 'T24_fiscal_param_keys' AS check_id,
  ARRAY[
    'commercial_revenue_limit',
    'vat_flat_deduction_pct',
    'vat_periodicity',
    'vat_rate_sponsorship',
    'vat_rounding_method'
  ] AS expected_keys_from_010,
  (
    SELECT array_agg(DISTINCT p.param_key ORDER BY p.param_key)
    FROM public.accounting_fiscal_params p
    WHERE p.param_key IN (
      'commercial_revenue_limit',
      'vat_flat_deduction_pct',
      'vat_periodicity',
      'vat_rate_sponsorship',
      'vat_rounding_method'
    )
  ) AS present_in_db;
-- Atteso: present_in_db contiene le 5 chiavi (se 010 applicata).
-- Nessuna chiave inventata in 018 oltre a queste.

-- T25 — COMMENT momento impositivo / legacy movement_id
SELECT 'T25_comments' AS check_id,
  (
    SELECT LEFT(col_description(
      'public.accounting_commercial_documents'::regclass,
      a.attnum
    ), 80)
    FROM pg_attribute a
    WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
      AND a.attname = 'movement_id'
      AND NOT a.attisdropped
  ) AS movement_id_comment_prefix,
  (
    SELECT LEFT(col_description(
      'public.accounting_commercial_documents'::regclass,
      a.attnum
    ), 80)
    FROM pg_attribute a
    WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
      AND a.attname = 'document_date'
      AND NOT a.attisdropped
  ) AS document_date_comment_prefix;
-- Atteso: movement_id comment contiene "deprecated";
--         document_date comment menziona momento impositivo / document_date

-- =============================================================================
-- T26+ — REVISIONE FINALE BLOCCANTE (solo SELECT)
-- =============================================================================

-- T26 — limite basis points = 10000 (non 100000)
SELECT 'T26_vat_rate_bp_max_10000' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
      AND pg_get_constraintdef(c.oid) ILIKE '%10000%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%100000%'
  ) AS bp_check_ok,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
      AND pg_get_constraintdef(c.oid) ILIKE '%100000%'
  ) AS no_legacy_100000;
-- Atteso: bp_check_ok=true, no_legacy_100000=true

-- T27 — unicità numero documento (indice parziale esclude cancelled)
SELECT 'T27_unique_document_number' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_accounting_commercial_documents_number_active'
  ) AS index_exists,
  (
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_accounting_commercial_documents_number_active'
  ) AS indexdef;
-- Atteso: index_exists=true; indexdef UNIQUE + btrim(document_number)
--         + status <> cancelled (o IS DISTINCT FROM cancelled)

-- T28 — prosrc issue: invoice number + VAT coherency + manage_settings override
SELECT 'T28_issue_guards_in_prosrc' AS check_id,
  (p.prosrc ILIKE '%document_type%invoice%') AS mentions_invoice,
  (p.prosrc ILIKE '%document_number%') AS mentions_number,
  (p.prosrc ILIKE '%accounting_vat_from_taxable%') AS mentions_vat_math,
  (p.prosrc ILIKE '%vat_rounding_method%') AS mentions_rounding_param,
  (p.prosrc ILIKE '%manage_settings%') AS mentions_rate_override_perm,
  (p.prosrc ILIKE '%duplicat%' OR p.prosrc ILIKE '%btrim%') AS mentions_dup_or_btrim
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_commercial_doc_issue';
-- Atteso: tutti true

-- T29 — prosrc cancel: blocca incassi / partially_collected; draft≠issued perms
SELECT 'T29_cancel_guards_in_prosrc' AS check_id,
  (p.prosrc ILIKE '%partially_collected%') AS blocks_partial,
  (p.prosrc ILIKE '%collected%') AS mentions_collected,
  (p.prosrc ILIKE '%accounting_commercial_doc_collected_cents%') AS checks_effective,
  (p.prosrc ILIKE '%edit_draft%') AS draft_perm,
  (p.prosrc ILIKE '%accounting.post%' OR p.prosrc ILIKE '%accounting.post%') AS post_perm
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_commercial_doc_cancel';
-- Atteso: blocks_partial=true; checks_effective=true; draft_perm=true; post_perm=true

-- T30 — helper interni SENZA EXECUTE authenticated
SELECT 'T30_helpers_no_authenticated_execute' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_fiscal_param_resolve',
    'accounting_fiscal_param_text',
    'accounting_fiscal_param_numeric',
    'accounting_round_half_up_cents',
    'accounting_vat_from_taxable',
    'accounting_vat_indicative_due_on',
    'accounting_commercial_payment_is_effective',
    'accounting_commercial_doc_collected_cents',
    'accounting_commercial_movement_allocated_cents',
    'accounting_commercial_doc_refresh_collection_status',
    'accounting_commercial_preferred_income_category_id',
    'accounting_commercial_document_payments_validate',
    'accounting_commercial_document_payments_after',
    'accounting_commercial_payments_on_movement_status',
    'accounting_commercial_documents_immutability',
    'accounting_vat_periods_immutability'
  )
  AND grantee = 'authenticated'
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name;
-- Atteso: 0 righe

-- T31 — soltanto RPC pubbliche con EXECUTE authenticated
SELECT 'T31_public_rpc_authenticated_execute' AS check_id,
  routine_name,
  COUNT(*) FILTER (WHERE grantee = 'authenticated' AND privilege_type = 'EXECUTE') AS auth_exec
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_commercial_doc_issue',
    'accounting_commercial_doc_cancel',
    'accounting_commercial_doc_register_payment',
    'accounting_commercial_doc_link_movement',
    'accounting_vat_period_calculate',
    'accounting_vat_period_verify',
    'accounting_vat_period_mark_paid'
  )
GROUP BY routine_name
ORDER BY routine_name;
-- Atteso: 7 righe, auth_exec >= 1 ciascuna

-- T32 — register_payment: account attivo, FY open, data in esercizio, SPONSOR
SELECT 'T32_register_payment_guards' AS check_id,
  (p.prosrc ILIKE '%is_active%') AS checks_account_active,
  (p.prosrc ILIKE '%open%') AS checks_fy_open,
  (p.prosrc ILIKE '%starts_on%' AND p.prosrc ILIKE '%ends_on%') AS checks_date_in_fy,
  (p.prosrc ILIKE '%EUR%') AS checks_eur,
  (p.prosrc ILIKE '%SPONSOR%') AS checks_sponsor_cat
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_commercial_doc_register_payment';
-- Atteso: tutti true

-- T33 — link_movement: posted + income + account + disponibile
SELECT 'T33_link_movement_guards' AS check_id,
  (p.prosrc ILIKE '%posted%') AS requires_posted,
  (p.prosrc ILIKE '%income%') AS requires_income,
  (p.prosrc ILIKE '%account_id%') AS requires_account,
  (p.prosrc ILIKE '%disponibile%' OR p.prosrc ILIKE '%allocated%') AS checks_available
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_commercial_doc_link_movement';
-- Atteso: tutti true

-- T34 — validazione matematica IVA (owner/SQL editor; helper non esposto a authenticated)
-- Richiede ruolo con EXECUTE su helper (postgres / service_role / owner migration).
SELECT 'T34_vat_math_coherence' AS check_id,
  public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent') AS expected_vat,
  (1000000 + public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent')) AS expected_gross,
  (
    public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent') = 220000
    AND (1000000 + 220000) = 1220000
  ) AS formula_ok;
-- Atteso: expected_vat=220000, expected_gross=1220000, formula_ok=true

-- T35 — preferred category: solo SPONSOR attivi (prosrc senza fallback ALTRE_ENTRATE)
SELECT 'T35_sponsor_category_helper' AS check_id,
  (p.prosrc ILIKE '%SPONSOR%') AS mentions_sponsor,
  (p.prosrc ILIKE '%is_active%') AS requires_active,
  (p.prosrc NOT ILIKE '%ALTRE_ENTRATE%') AS no_altre_entrate_fallback
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_commercial_preferred_income_category_id';
-- Atteso: mentions_sponsor=true, requires_active=true, no_altre_entrate_fallback=true
