-- =============================================================================
-- 016_accounting_budget_test.sql
-- =============================================================================
-- Test statici post-apply 016 (SQL Editor). NON applicare 016 da questo file.
--
-- T1–T8: metadati / trigger / privilegi
-- T9:    test funzionale DOCUMENTATO — riga manuale QUOTE deve fallire
--        (eseguire solo dopo 016, con FY e budget draft esistenti, oppure
--         scommentare il blocco DO dopo aver creato fixture minime).
-- =============================================================================

-- T1 — tabelle presenti
SELECT 'T1_tables' AS check_id,
  to_regclass('public.accounting_budgets') IS NOT NULL AS budgets_ok,
  to_regclass('public.accounting_budget_lines') IS NOT NULL AS lines_ok;

-- T2 — indice unico attivo per FY
SELECT 'T2_unique_active_fy' AS check_id,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_accounting_budgets_active_fy'
  ) AS ok;

-- T3 — funzioni trigger: search_path + EXECUTE
SELECT 'T3_forbid_quote_fn' AS check_id,
  p.prosecdef AS security_definer_unused,
  pg_get_function_identity_arguments(p.oid) AS args,
  (
    SELECT string_agg(cfg, ',')
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
  ) AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_budget_forbid_quote_category';

SELECT 'T3b_stamp_approval_fn' AS check_id,
  (
    SELECT string_agg(cfg, ',')
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
  ) AS proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_budget_stamp_approval';

-- T4 — trigger QUOTE su budget_lines
SELECT 'T4_trg_forbid_quote' AS check_id,
  t.tgname,
  p.proname AS function_name,
  CASE WHEN t.tgenabled = 'D' THEN 'disabled' ELSE 'enabled' END AS state
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_budget_lines'
  AND t.tgname = 'trg_accounting_budget_forbid_quote_category'
  AND NOT t.tgisinternal;

-- T5 — trigger stamp approval su budgets
SELECT 'T5_trg_stamp_approval' AS check_id,
  t.tgname,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_budgets'
  AND t.tgname = 'trg_accounting_budgets_stamp_approval'
  AND NOT t.tgisinternal;

-- T6 — CHECK manual_only
SELECT 'T6_manual_only_check' AS check_id,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_budget_lines_manual_only'
      AND conrelid = 'public.accounting_budget_lines'::regclass
  ) AS ok;

-- T7 — anon senza privilegi
SELECT 'T7_anon_privs' AS check_id,
  COUNT(*) AS anon_grants
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('accounting_budgets', 'accounting_budget_lines')
  AND grantee = 'anon';
-- Atteso: 0

-- T8 — EXECUTE funzioni: non a anon/PUBLIC
SELECT 'T8_fn_execute' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'accounting_budget_forbid_quote_category',
    'accounting_budget_stamp_approval'
  )
  AND grantee IN ('anon', 'PUBLIC')
ORDER BY routine_name, grantee;
-- Atteso: 0 righe

-- =============================================================================
-- T9 — TEST FUNZIONALE ESEGUIBILE
-- Tentativo INSERT riga manuale con categoria QUOTE → DEVE FALLIRE.
-- Crea (se serve) un preventivo draft temporaneo e lo rimuove in fine.
-- Prerequisito: 016 applicata + almeno un fiscal_year + categoria QUOTE.
-- Esito: una riga con check_id/status/detail (niente NOTICE da cercare).
-- =============================================================================
DO $$
DECLARE
  v_fy uuid;
  v_quote uuid;
  v_budget uuid;
  v_created_budget boolean := false;
  v_ok boolean := false;
  v_detail text;
BEGIN
  SELECT id INTO v_quote
  FROM public.accounting_categories
  WHERE upper(code) = 'QUOTE'
  LIMIT 1;

  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'T9 FAIL setup: categoria QUOTE assente';
  END IF;

  SELECT id INTO v_fy
  FROM public.accounting_fiscal_years
  ORDER BY starts_on DESC
  LIMIT 1;

  IF v_fy IS NULL THEN
    RAISE EXCEPTION 'T9 FAIL setup: nessun esercizio contabile';
  END IF;

  SELECT id INTO v_budget
  FROM public.accounting_budgets
  WHERE fiscal_year_id = v_fy
    AND status = 'draft'
  LIMIT 1;

  IF v_budget IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.accounting_budgets
      WHERE fiscal_year_id = v_fy AND status IN ('draft', 'approved')
    ) THEN
      RAISE EXCEPTION
        'T9 FAIL setup: nessun budget draft e già presente draft/approved su FY %',
        v_fy;
    END IF;

    INSERT INTO public.accounting_budgets (fiscal_year_id, name, status, version)
    VALUES (v_fy, 'T9 temp preventivo', 'draft', 1)
    RETURNING id INTO v_budget;
    v_created_budget := true;
  END IF;

  BEGIN
    INSERT INTO public.accounting_budget_lines (
      budget_id, category_id, direction, description, planned_amount_cents, source_type
    ) VALUES (
      v_budget, v_quote, 'income', 'T9 tentativo QUOTE manuale', 1000, 'manual'
    );
    v_ok := false;
    v_detail := 'insert QUOTE accettato (atteso rifiuto dal trigger)';
  EXCEPTION
    WHEN check_violation THEN
      v_ok := true;
      v_detail := SQLERRM;
  END;

  IF v_created_budget THEN
    DELETE FROM public.accounting_budgets WHERE id = v_budget;
  END IF;

  -- Tabella temporanea leggibile dal SELECT successivo nella stessa sessione
  CREATE TEMP TABLE IF NOT EXISTS _t9_quote_block_result (
    check_id text,
    status text,
    detail text
  ) ON COMMIT PRESERVE ROWS;

  DELETE FROM _t9_quote_block_result;

  IF v_ok THEN
    INSERT INTO _t9_quote_block_result VALUES (
      'T9_functional_quote_block',
      'OK',
      v_detail
    );
  ELSE
    INSERT INTO _t9_quote_block_result VALUES (
      'T9_functional_quote_block',
      'FAIL',
      v_detail
    );
    RAISE EXCEPTION 'T9 FAIL: %', v_detail;
  END IF;
END $$;

SELECT check_id, status, detail
FROM _t9_quote_block_result;
