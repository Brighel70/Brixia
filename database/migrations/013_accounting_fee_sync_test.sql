-- =============================================================================
-- 013_accounting_fee_sync_test.sql
-- =============================================================================
-- SEZIONE A — TEST STATICI READ-ONLY (eseguibili dopo applicazione 013)
-- Solo SELECT / catalogo. Nessun INSERT/UPDATE/DELETE di dati applicativi.
-- Nessun dato personale. Non sostituiscono i test funzionali.
-- =============================================================================

-- T1 — outbox esiste
SELECT
  'T1_outbox_exists' AS check_id,
  COUNT(*) AS n
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'accounting_sync_outbox';
-- Atteso: 1

-- T2 — RLS outbox
SELECT
  'T2_outbox_rls' AS check_id,
  c.relname,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'accounting_sync_outbox';
-- Atteso: true

-- T3 — anon/PUBLIC senza privilegi outbox
SELECT
  'T3_outbox_anon_public' AS check_id,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'accounting_sync_outbox'
  AND grantee IN ('anon', 'PUBLIC')
ORDER BY grantee, privilege_type;
-- Atteso: 0

-- T4 — authenticated solo SELECT outbox
SELECT
  'T4_outbox_authenticated' AS check_id,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'accounting_sync_outbox'
  AND grantee = 'authenticated'
ORDER BY privilege_type;
-- Atteso: solo SELECT

-- T5 — trigger su fee_assignments / payments
SELECT
  'T5_quote_sync_triggers' AS check_id,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN ('fee_assignments', 'payments')
  AND t.tgname LIKE 'trg_accounting%'
ORDER BY c.relname, t.tgname;
-- Atteso: trg_accounting_fee_assignments_sync, trg_accounting_payments_sync

-- T6 — nessun trigger accounting su fees / payment_receipts
SELECT
  'T6_no_triggers_fees_receipts' AS check_id,
  c.relname AS table_name,
  t.tgname,
  p.proname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND c.relname IN ('fees', 'payment_receipts')
  AND (p.proname LIKE 'accounting%' OR t.tgname ILIKE '%accounting%');
-- Atteso: 0

-- T7 — funzioni chiave: security_definer + search_path
SELECT
  'T7_function_security' AS check_id,
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'accounting_fee_process_outbox_row',
    'accounting_fee_enqueue_and_try',
    'accounting_trg_fee_assignments_sync',
    'accounting_trg_payments_sync',
    'accounting_process_pending_sync',
    'accounting_reconcile_fees_preview',
    'accounting_reconcile_fees_apply',
    'accounting_audit_write'
  )
ORDER BY p.proname;

-- T8 — PUBLIC/anon senza EXECUTE sulle funzioni interne sync
SELECT
  'T8_internal_fn_public_anon' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_fee_process_outbox_row',
    'accounting_fee_enqueue_and_try',
    'accounting_fee_sync_assignment',
    'accounting_fee_sync_payment_insert',
    'accounting_fee_sync_payment_delete',
    'accounting_audit_write'
  )
  AND grantee IN ('PUBLIC', 'anon')
  AND privilege_type = 'EXECUTE';
-- Atteso: 0

-- T9 — link_type payment_reversal ammesso
SELECT
  'T9_payment_reversal_link_type' AS check_id,
  c.conname,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.accounting_source_links'::regclass
  AND c.conname IN (
    'accounting_source_links_link_type_check',
    'accounting_source_links_type_targets'
  )
ORDER BY c.conname;
-- Atteso: definitions contengono payment_reversal

-- T10 — Quote vuote
SELECT
  'T10_quote_empty' AS check_id,
  (SELECT COUNT(*)::int FROM public.fee_assignments) AS fee_assignments,
  (SELECT COUNT(*)::int FROM public.payments) AS payments,
  (SELECT COUNT(*)::int FROM public.fees) AS fees;
-- Atteso: 0,0,0 (o fees eventualmente >0 se non cancellati i template; preferibile 0)

-- T11 — Contabilita operativa vuota (core sync targets)
SELECT
  'T11_accounting_ops_empty' AS check_id,
  (SELECT COUNT(*)::int FROM public.accounting_receivables) AS receivables,
  (SELECT COUNT(*)::int FROM public.accounting_movements) AS movements,
  (SELECT COUNT(*)::int FROM public.accounting_source_links) AS source_links,
  (SELECT COUNT(*)::int FROM public.accounting_sync_outbox) AS outbox;
-- Atteso: 0

-- T12 — esercizio 2026 open
SELECT
  'T12_fiscal_year_2026' AS check_id,
  code,
  starts_on,
  ends_on,
  status,
  currency
FROM public.accounting_fiscal_years
WHERE code = '2026';
-- Atteso: 1 riga open EUR 2026-01-01..2026-12-31

-- T13 — categoria QUOTE
SELECT
  'T13_category_quote' AS check_id,
  code,
  name,
  is_system
FROM public.accounting_categories
WHERE code = 'QUOTE';
-- Atteso: 1

-- T14 — mapping Cassa/Banca
SELECT
  'T14_method_map' AS check_id,
  m.raw_payment_method,
  a.code AS account_code
FROM public.accounting_payment_method_account_map m
JOIN public.accounting_accounts a ON a.id = m.account_id
WHERE m.source_system = 'fees'
  AND m.raw_payment_method IN ('cash', 'contanti', 'bank_transfer', 'bonifico')
ORDER BY m.raw_payment_method;
-- Atteso: 4

-- T15 — policy outbox: nessuna scrittura authenticated
SELECT
  'T15_outbox_write_policies' AS check_id,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'accounting_sync_outbox'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
-- Atteso: 0

-- T16 — wrapper EXECUTE authenticated presenti
SELECT
  'T16_wrapper_grants' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_process_pending_sync',
    'accounting_reconcile_fees_preview',
    'accounting_reconcile_fees_apply'
  )
  AND grantee = 'authenticated'
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name;

-- T17 — FK Quote senza ON DELETE CASCADE (schema Supabase reale)
SELECT
  'T17_quote_fk_no_cascade' AS check_id,
  tc.constraint_name,
  kcu.table_name AS from_table,
  ccu.table_name AS to_table,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON rc.unique_constraint_name = ccu.constraint_name
  AND rc.constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND (
    (kcu.table_name = 'payments' AND kcu.column_name = 'assignment_id')
    OR (kcu.table_name = 'fee_assignments' AND kcu.column_name IN ('fee_id', 'person_id'))
  )
ORDER BY kcu.table_name, kcu.column_name;
-- Atteso: delete_rule <> CASCADE (tipicamente NO ACTION / RESTRICT)

-- T18 — assignment_delete disattiva link (corpo funzione)
SELECT
  'T18_assignment_delete_deactivates_link' AS check_id,
  (pg_get_functiondef(p.oid) ILIKE '%is_active = false%'
    AND pg_get_functiondef(p.oid) ILIKE '%assignment_receivable%') AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_fee_sync_assignment_delete';
-- Atteso: ok = true

-- T19 — payment_delete disattiva payment_movement e crea payment_reversal inattivo
SELECT
  'T19_payment_delete_link_semantics' AS check_id,
  (pg_get_functiondef(p.oid) ILIKE '%payment_movement%'
    AND pg_get_functiondef(p.oid) ILIKE '%is_active = false%'
    AND pg_get_functiondef(p.oid) ILIKE '%payment_reversal%') AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_fee_sync_payment_delete';
-- Atteso: ok = true

-- T20 — payment_insert rifiuta link payment_movement inattivo (non idempotent cieco)
SELECT
  'T20_payment_insert_inactive_link_guard' AS check_id,
  (pg_get_functiondef(p.oid) ILIKE '%payment_movement inattivo%'
    OR pg_get_functiondef(p.oid) ILIKE '%UUID riutilizzato%') AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_fee_sync_payment_insert';
-- Atteso: ok = true

-- T21 — reconcile preview confronta ID / is_active (non solo COUNT grezzi)
SELECT
  'T21_reconcile_preview_set_logic' AS check_id,
  (pg_get_functiondef(p.oid) ILIKE '%assignments_missing_active_link%'
    AND pg_get_functiondef(p.oid) ILIKE '%active_payment_links_without_source%'
    AND pg_get_functiondef(p.oid) ILIKE '%collected_mismatch_count%'
    AND pg_get_functiondef(p.oid) ILIKE '%is_active IS TRUE%') AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_reconcile_fees_preview';
-- Atteso: ok = true

-- T22 — assignment sync riattiva link (is_active = true)
SELECT
  'T22_assignment_reactivates_link' AS check_id,
  (pg_get_functiondef(p.oid) ILIKE '%is_active = true%'
    AND pg_get_functiondef(p.oid) ILIKE '%assignment_receivable%') AS ok
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_fee_sync_assignment';
-- Atteso: ok = true

-- T23 — colonna is_active presente su accounting_source_links
SELECT
  'T23_source_links_is_active_column' AS check_id,
  COUNT(*) AS n
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'accounting_source_links'
  AND column_name = 'is_active';
-- Atteso: 1

-- T24 — preview a Quote/Contabilità vuote: aligned true (solo se 013 applicata e dati vuoti)
-- Eseguire solo dopo migration; richiede permesso accounting.view/verify o Admin.
-- SELECT public.accounting_reconcile_fees_preview();
-- Atteso (ambiente vuoto): aligned=true, mismatch counts=0

-- =============================================================================
-- SEZIONE B — PIANO TEST FUNZIONALI (DOCUMENTAZIONE ONLY — NON ESEGUIRE ORA)
-- =============================================================================
-- Questi passi CREANO / MODIFICANO / ELIMINANO dati. Richiedono autorizzazione
-- esplicita dopo applicazione della migration e dopo i test statici (Sezione A).
-- Cleanup concordato obbligatorio a fine sessione.
-- =============================================================================
-- F1. creare quota test; assegnare 50000 centesimi (500 EUR)
-- F2. verificare receivable 50000/0/50000 status=assigned; link assignment_receivable is_active=true
-- F3. pagare 20000 (cash) → payment_movement attivo; residual 30000
-- F4. accounting_reconcile_fees_preview() → aligned=true
-- F5. voidPayment del 20000 → payment_delete:
--     - movimento originale reversed
--     - payment_reversal creato (is_active=false)
--     - payment_movement originale is_active=false
--     - residual = expected; collected = 0
-- F6. preview → aligned=true (link inattivi / reversal non contano come pagamenti attivi)
-- F7. eliminare assegnazione (zero payments/receipts) → assignment_delete:
--     - receivable cancelled
--     - assignment_receivable is_active=false
-- F8. preview → aligned=true
-- F9. accounting_reconcile_fees_apply() ripetuto → zero duplicati source_links / movements
-- F10. cleanup controllato (payment_receipts → payments → fee_assignments; Contabilità soft)
-- F11. (opzionale) fail-safe: errore processore; Quote completa; outbox failed; reconcile apply
-- =============================================================================
