-- =============================================================================
-- 012_accounting_core_report.sql
-- READ-ONLY — una sola riga JSONB: T1–T25
-- Solo SELECT / CTE. Nessuna modifica dati.
-- Colonna: accounting_core_test_report
-- =============================================================================

WITH
core_tables AS (
  SELECT ARRAY[
    'accounting_counterparties',
    'accounting_receivables',
    'accounting_movements',
    'accounting_movement_allocations',
    'accounting_source_links',
    'accounting_audit_log'
  ]::text[] AS names
),

t1 AS (
  SELECT COALESCE(ARRAY_AGG(t.table_name ORDER BY t.table_name), ARRAY[]::text[]) AS table_names
  FROM information_schema.tables t
  CROSS JOIN core_tables ct
  WHERE t.table_schema = 'public' AND t.table_name = ANY (ct.names)
),
t1_eval AS (
  SELECT
    CASE WHEN COALESCE(ARRAY_LENGTH(table_names, 1), 0) = 6 THEN 'pass' ELSE 'fail' END AS status,
    'Esattamente 6 tabelle core Contabilita'::text AS expected,
    jsonb_build_object('count', COALESCE(ARRAY_LENGTH(table_names, 1), 0), 'table_names', TO_JSONB(table_names)) AS actual,
    '{}'::jsonb AS details
  FROM t1
),

t2 AS (
  SELECT
    COALESCE(JSONB_AGG(jsonb_build_object('table_name', c.relname, 'rls_enabled', c.relrowsecurity) ORDER BY c.relname), '[]'::jsonb) AS rows,
    BOOL_AND(c.relrowsecurity) AS all_on,
    COUNT(*)::int AS found_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN core_tables ct
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY (ct.names)
),
t2_eval AS (
  SELECT
    CASE WHEN found_count = 6 AND COALESCE(all_on, false) THEN 'pass' ELSE 'fail' END AS status,
    'RLS attiva su tutte e 6'::text AS expected,
    jsonb_build_object('found_count', found_count, 'all_rls_enabled', COALESCE(all_on, false), 'tables', rows) AS actual,
    '{}'::jsonb AS details
  FROM t2
),

t3_g AS (
  SELECT g.table_name, g.privilege_type
  FROM information_schema.role_table_grants g
  CROSS JOIN core_tables ct
  WHERE g.table_schema = 'public' AND g.table_name = ANY (ct.names) AND g.grantee = 'anon'
),
t3_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM t3_g) THEN 'pass' ELSE 'fail' END AS status,
    'anon senza privilegi sulle 6 tabelle (0 righe)'::text AS expected,
    jsonb_build_object(
      'anon_grants', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'privilege_type', privilege_type) ORDER BY table_name, privilege_type) FROM t3_g), '[]'::jsonb),
      'count', (SELECT COUNT(*)::int FROM t3_g)
    ) AS actual,
    '{}'::jsonb AS details
),

t4_g AS (
  SELECT g.table_name, g.privilege_type
  FROM information_schema.role_table_grants g
  CROSS JOIN core_tables ct
  WHERE g.table_schema = 'public' AND g.table_name = ANY (ct.names) AND g.grantee = 'PUBLIC'
),
t4_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM t4_g) THEN 'pass' ELSE 'fail' END AS status,
    'PUBLIC senza privilegi sulle 6 tabelle (0 righe)'::text AS expected,
    jsonb_build_object(
      'public_grants', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'privilege_type', privilege_type) ORDER BY table_name, privilege_type) FROM t4_g), '[]'::jsonb),
      'count', (SELECT COUNT(*)::int FROM t4_g)
    ) AS actual,
    '{}'::jsonb AS details
),

t5_g AS (
  SELECT g.table_name, g.privilege_type
  FROM information_schema.role_table_grants g
  CROSS JOIN core_tables ct
  WHERE g.table_schema = 'public' AND g.table_name = ANY (ct.names) AND g.grantee = 'authenticated'
),
t5_forbidden AS (
  SELECT * FROM t5_g
  WHERE
    (table_name = 'accounting_counterparties' AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE'))
    OR (table_name = 'accounting_receivables' AND privilege_type <> 'SELECT')
    OR (table_name = 'accounting_movements' AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE'))
    OR (table_name = 'accounting_movement_allocations' AND privilege_type NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE'))
    OR (table_name = 'accounting_source_links' AND privilege_type <> 'SELECT')
    OR (table_name = 'accounting_audit_log' AND privilege_type <> 'SELECT')
),
t5_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t5_forbidden) THEN 'fail'
      WHEN EXISTS (SELECT 1 FROM t5_g WHERE table_name = 'accounting_movements' AND privilege_type = 'DELETE') THEN 'fail'
      WHEN (
        SELECT COUNT(*) FROM t5_g WHERE table_name = 'accounting_counterparties' AND privilege_type IN ('SELECT','INSERT','UPDATE')
      ) = 3
      AND (
        SELECT COUNT(*) FROM t5_g WHERE table_name = 'accounting_receivables' AND privilege_type = 'SELECT'
      ) = 1
      AND (
        SELECT COUNT(*) FROM t5_g WHERE table_name = 'accounting_movements' AND privilege_type IN ('SELECT','INSERT','UPDATE')
      ) = 3
      AND (
        SELECT COUNT(*) FROM t5_g WHERE table_name = 'accounting_movement_allocations' AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')
      ) = 4
      AND (
        SELECT COUNT(*) FROM t5_g WHERE table_name = 'accounting_source_links' AND privilege_type = 'SELECT'
      ) = 1
      AND (
        SELECT COUNT(*) FROM t5_g WHERE table_name = 'accounting_audit_log' AND privilege_type = 'SELECT'
      ) = 1
      THEN 'pass'
      ELSE 'fail'
    END AS status,
    'Privilegi authenticated minimi esatti per tabella (no DELETE movements)'::text AS expected,
    jsonb_build_object(
      'grants', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'privilege_type', privilege_type) ORDER BY table_name, privilege_type) FROM t5_g), '[]'::jsonb),
      'forbidden', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'privilege_type', privilege_type) ORDER BY table_name, privilege_type) FROM t5_forbidden), '[]'::jsonb)
    ) AS actual,
    jsonb_build_object('note', 'Include T5b/T5c') AS details
),

t6_p AS (
  SELECT tablename, policyname, roles, cmd
  FROM pg_policies
  CROSS JOIN core_tables ct
  WHERE schemaname = 'public'
    AND tablename = ANY (ct.names)
    AND (roles::text ILIKE '%anon%' OR roles::text ILIKE '%public%')
),
t6_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM t6_p) THEN 'pass' ELSE 'fail' END AS status,
    'Nessuna policy anon/public'::text AS expected,
    jsonb_build_object('bad_policies', COALESCE((SELECT JSONB_AGG(jsonb_build_object('tablename', tablename, 'policyname', policyname, 'cmd', cmd) ORDER BY tablename) FROM t6_p), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t7_p AS (
  SELECT tablename, policyname, cmd
  FROM pg_policies
  CROSS JOIN core_tables ct
  WHERE schemaname = 'public' AND tablename = ANY (ct.names) AND cmd = 'DELETE'
),
t7_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t7_p WHERE tablename <> 'accounting_movement_allocations') THEN 'fail'
      WHEN EXISTS (SELECT 1 FROM t7_p WHERE tablename = 'accounting_movements') THEN 'fail'
      WHEN (SELECT COUNT(*) FROM t7_p WHERE tablename = 'accounting_movement_allocations') = 1 THEN 'pass'
      ELSE 'fail'
    END AS status,
    'DELETE policy solo su allocations; nessuna su movements'::text AS expected,
    jsonb_build_object('delete_policies', COALESCE((SELECT JSONB_AGG(jsonb_build_object('tablename', tablename, 'policyname', policyname) ORDER BY tablename) FROM t7_p), '[]'::jsonb)) AS actual,
    jsonb_build_object('note', 'Include T7b') AS details
),

t8_fk AS (
  SELECT tc.table_name AS from_table, kcu.column_name AS from_column, rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_schema = tc.constraint_schema AND ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_schema = tc.constraint_schema AND rc.constraint_name = tc.constraint_name
  CROSS JOIN core_tables ct
  WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = ANY (ct.names) AND ccu.table_name = 'profiles'
),
t8_eval AS (
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM t8_fk) THEN 'fail'
      WHEN EXISTS (SELECT 1 FROM t8_fk WHERE delete_rule IS DISTINCT FROM 'SET NULL') THEN 'fail'
      ELSE 'pass'
    END AS status,
    'Tutte le FK verso profiles con ON DELETE SET NULL'::text AS expected,
    jsonb_build_object(
      'fks', COALESCE((SELECT JSONB_AGG(jsonb_build_object('from_table', from_table, 'from_column', from_column, 'delete_rule', delete_rule) ORDER BY from_table, from_column) FROM t8_fk), '[]'::jsonb),
      'non_set_null_count', (SELECT COUNT(*)::int FROM t8_fk WHERE delete_rule IS DISTINCT FROM 'SET NULL')
    ) AS actual,
    '{}'::jsonb AS details
),

t9_fk AS (
  SELECT tc.table_name AS from_table, kcu.column_name AS from_column, ccu.table_name AS to_table
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_schema = tc.constraint_schema AND ccu.constraint_name = tc.constraint_name
  CROSS JOIN core_tables ct
  WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = ANY (ct.names)
    AND ccu.table_name IN ('fees', 'fee_assignments', 'payments', 'payment_receipts', 'people3')
),
t9_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM t9_fk) THEN 'pass' ELSE 'fail' END AS status,
    'Nessuna FK verso Quote o people3'::text AS expected,
    jsonb_build_object('quote_fks', COALESCE((SELECT JSONB_AGG(jsonb_build_object('from_table', from_table, 'from_column', from_column, 'to_table', to_table)) FROM t9_fk), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t10_fk AS (
  SELECT tc.table_name AS from_table, kcu.column_name AS from_column, ccu.table_name AS to_table, rc.delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_schema = tc.constraint_schema AND ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_schema = tc.constraint_schema AND rc.constraint_name = tc.constraint_name
  WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('accounting_counterparties', 'accounting_receivables', 'accounting_movement_allocations')
    AND ccu.table_name IN ('people', 'categories', 'events')
),
t10_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t10_fk WHERE from_table = 'accounting_counterparties' AND from_column = 'people_id' AND to_table = 'people' AND delete_rule = 'SET NULL')
       AND EXISTS (SELECT 1 FROM t10_fk WHERE from_table = 'accounting_receivables' AND from_column = 'person_id' AND to_table = 'people')
       AND EXISTS (SELECT 1 FROM t10_fk WHERE from_table = 'accounting_movement_allocations' AND from_column = 'team_category_id' AND to_table = 'categories')
       AND EXISTS (SELECT 1 FROM t10_fk WHERE from_table = 'accounting_movement_allocations' AND from_column = 'event_id' AND to_table = 'events')
      THEN 'pass'
      ELSE 'fail'
    END AS status,
    'FK people/categories/events presenti e corrette'::text AS expected,
    jsonb_build_object('fks', COALESCE((SELECT JSONB_AGG(jsonb_build_object('from_table', from_table, 'from_column', from_column, 'to_table', to_table, 'delete_rule', delete_rule) ORDER BY from_table, from_column) FROM t10_fk), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t11_idx AS (
  SELECT c.relname AS tbl, i.relname AS index_name, pg_get_indexdef(i.oid) AS index_def
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class c ON c.oid = x.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('accounting_receivables', 'accounting_source_links')
    AND x.indisunique
    AND (i.relname ILIKE '%source%' OR pg_get_indexdef(i.oid) ILIKE '%source_system%' OR pg_get_indexdef(i.oid) ILIKE '%link_type%')
),
t11_cols AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'accounting_source_links'
    AND column_name IN ('link_type', 'source_event_type')
),
t11_checks AS (
  SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.accounting_source_links'::regclass AND c.contype = 'c'
),
t11_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t11_cols WHERE column_name = 'source_event_type') THEN 'fail'
      WHEN NOT EXISTS (SELECT 1 FROM t11_cols WHERE column_name = 'link_type') THEN 'fail'
      WHEN NOT EXISTS (SELECT 1 FROM t11_idx WHERE tbl = 'accounting_receivables') THEN 'fail'
      WHEN NOT EXISTS (SELECT 1 FROM t11_idx WHERE tbl = 'accounting_source_links' AND index_def ILIKE '%link_type%') THEN 'fail'
      WHEN NOT EXISTS (SELECT 1 FROM t11_checks WHERE definition ILIKE '%assignment_receivable%') THEN 'fail'
      ELSE 'pass'
    END AS status,
    'Unique source + link_type; no source_event_type; CHECK link_type/target'::text AS expected,
    jsonb_build_object(
      'indexes', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table', tbl, 'index_name', index_name, 'index_def', index_def)) FROM t11_idx), '[]'::jsonb),
      'columns', COALESCE((SELECT JSONB_AGG(column_name ORDER BY column_name) FROM t11_cols), '[]'::jsonb),
      'checks', COALESCE((SELECT JSONB_AGG(jsonb_build_object('conname', conname, 'definition', definition) ORDER BY conname) FROM t11_checks), '[]'::jsonb)
    ) AS actual,
    jsonb_build_object('note', 'Include T11b/T11c') AS details
),

t12_c AS (
  SELECT c.conrelid::regclass::text AS table_name, c.conname, pg_get_constraintdef(c.oid) AS definition
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
),
t12_eval AS (
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM t12_c) >= 3 THEN 'pass' ELSE 'fail' END AS status,
    'CHECK importi su receivables/movements/allocations'::text AS expected,
    jsonb_build_object('constraints', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'conname', conname, 'definition', definition) ORDER BY table_name, conname) FROM t12_c), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t13 AS (
  SELECT a.attgenerated AS generated_kind, pg_get_expr(ad.adbin, ad.adrelid) AS generation_expression
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  WHERE n.nspname = 'public' AND c.relname = 'accounting_receivables'
    AND a.attname = 'residual_amount_cents' AND NOT a.attisdropped
),
t13_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t13 WHERE generated_kind = 's' AND generation_expression ILIKE '%GREATEST%') THEN 'pass'
      ELSE 'fail'
    END AS status,
    'residual_amount_cents GENERATED STORED con GREATEST'::text AS expected,
    jsonb_build_object('residual', COALESCE((SELECT JSONB_AGG(jsonb_build_object('generated_kind', generated_kind, 'generation_expression', generation_expression)) FROM t13), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t14_eval AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM public.accounting_counterparties) = 0
       AND (SELECT COUNT(*) FROM public.accounting_receivables) = 0
       AND (SELECT COUNT(*) FROM public.accounting_movements) = 0
       AND (SELECT COUNT(*) FROM public.accounting_movement_allocations) = 0
       AND (SELECT COUNT(*) FROM public.accounting_source_links) = 0
       AND (SELECT COUNT(*) FROM public.accounting_audit_log) = 0
      THEN 'pass' ELSE 'fail'
    END AS status,
    'Zero seed sulle 6 tabelle core'::text AS expected,
    jsonb_build_object(
      'counterparties', (SELECT COUNT(*)::int FROM public.accounting_counterparties),
      'receivables', (SELECT COUNT(*)::int FROM public.accounting_receivables),
      'movements', (SELECT COUNT(*)::int FROM public.accounting_movements),
      'allocations', (SELECT COUNT(*)::int FROM public.accounting_movement_allocations),
      'source_links', (SELECT COUNT(*)::int FROM public.accounting_source_links),
      'audit_log', (SELECT COUNT(*)::int FROM public.accounting_audit_log)
    ) AS actual,
    '{}'::jsonb AS details
),

t15_tr AS (
  SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal AND n.nspname = 'public'
    AND c.relname IN ('fees', 'fee_assignments', 'payments', 'payment_receipts')
    AND (p.proname LIKE 'accounting%' OR t.tgname ILIKE '%accounting%')
),
t15_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (SELECT 1 FROM t15_tr) THEN 'pass' ELSE 'fail' END AS status,
    'Nessun trigger accounting sulle Quote'::text AS expected,
    jsonb_build_object('triggers', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'trigger_name', trigger_name, 'function_name', function_name)) FROM t15_tr), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t16_tr AS (
  SELECT c.relname AS table_name, t.tgname AS trigger_name, p.proname AS function_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  CROSS JOIN core_tables ct
  WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname = ANY (ct.names)
),
t16_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'accounting_protect_movement_immutability') THEN 'fail'
      WHEN EXISTS (SELECT 1 FROM t16_tr WHERE trigger_name = 'trg_accounting_movements_immutability' OR function_name = 'accounting_protect_movement_immutability') THEN 'fail'
      ELSE 'pass'
    END AS status,
    'Trigger core ok; nessuna immutabilita movements (fn/trigger assenti)'::text AS expected,
    jsonb_build_object(
      'core_triggers', COALESCE((SELECT JSONB_AGG(jsonb_build_object('table_name', table_name, 'trigger_name', trigger_name, 'function_name', function_name) ORDER BY table_name, trigger_name) FROM t16_tr), '[]'::jsonb),
      'immutability_fn_present', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'accounting_protect_movement_immutability')
    ) AS actual,
    jsonb_build_object('note', 'Include T16b/T16c') AS details
),

t17_pol AS (
  SELECT policyname, cmd FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'accounting_audit_log' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
),
t17_gr AS (
  SELECT privilege_type FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'accounting_audit_log'
    AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
),
t17_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t17_pol) THEN 'fail'
      WHEN EXISTS (SELECT 1 FROM t17_gr) THEN 'fail'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'accounting_protect_audit_append_only'
      ) THEN 'fail'
      ELSE 'pass'
    END AS status,
    'Audit append-only: no write policies/grants authenticated; fn protect presente'::text AS expected,
    jsonb_build_object(
      'write_policies', COALESCE((SELECT JSONB_AGG(jsonb_build_object('policyname', policyname, 'cmd', cmd)) FROM t17_pol), '[]'::jsonb),
      'write_grants', COALESCE((SELECT JSONB_AGG(privilege_type) FROM t17_gr), '[]'::jsonb),
      'protect_fn', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'accounting_protect_audit_append_only')
    ) AS actual,
    jsonb_build_object('note', 'Include T17b/T17c') AS details
),

t18_pol AS (
  SELECT policyname, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'accounting_movements'
),
t18_bad AS (
  SELECT * FROM t18_pol
  WHERE cmd = 'UPDATE'
    AND (
      (qual IS NOT NULL AND qual NOT ILIKE '%draft%' AND qual NOT ILIKE '%pending_account%')
      OR (with_check IS NOT NULL AND with_check NOT ILIKE '%draft%' AND with_check NOT ILIKE '%pending_account%')
    )
),
t18_eval AS (
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM t18_bad) THEN 'fail'
      WHEN EXISTS (
        SELECT 1 FROM t18_pol
        WHERE cmd = 'INSERT' AND with_check ILIKE '%draft%' AND with_check ILIKE '%pending_account%'
      )
      AND EXISTS (
        SELECT 1 FROM t18_pol
        WHERE cmd = 'UPDATE' AND COALESCE(qual, '') ILIKE '%draft%' AND COALESCE(with_check, '') ILIKE '%draft%'
      )
      THEN 'pass'
      ELSE 'fail'
    END AS status,
    'Movements: INSERT/UPDATE solo draft/pending_account; nessun Admin bypass posted'::text AS expected,
    jsonb_build_object(
      'policies', COALESCE((SELECT JSONB_AGG(jsonb_build_object('policyname', policyname, 'cmd', cmd, 'using_expression', qual, 'with_check_expression', with_check) ORDER BY cmd, policyname) FROM t18_pol), '[]'::jsonb),
      'bad_update_policies', COALESCE((SELECT JSONB_AGG(jsonb_build_object('policyname', policyname)) FROM t18_bad), '[]'::jsonb)
    ) AS actual,
    jsonb_build_object('note', 'Include T18b') AS details
),

t19_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'accounting_source_links' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    ) THEN 'pass' ELSE 'fail' END AS status,
    'source_links senza policy di scrittura'::text AS expected,
    jsonb_build_object(
      'write_policies', COALESCE((
        SELECT JSONB_AGG(jsonb_build_object('policyname', policyname, 'cmd', cmd))
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'accounting_source_links' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      ), '[]'::jsonb)
    ) AS actual,
    '{}'::jsonb AS details
),

t20_eval AS (
  SELECT
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'accounting_receivables' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    ) THEN 'pass' ELSE 'fail' END AS status,
    'receivables senza policy di scrittura'::text AS expected,
    jsonb_build_object(
      'write_policies', COALESCE((
        SELECT JSONB_AGG(jsonb_build_object('policyname', policyname, 'cmd', cmd))
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'accounting_receivables' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
      ), '[]'::jsonb)
    ) AS actual,
    '{}'::jsonb AS details
),

t21_eval AS (
  SELECT
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'accounting_settings', 'accounting_fiscal_params', 'accounting_fiscal_years',
        'accounting_accounts', 'accounting_categories', 'accounting_payment_method_account_map'
      )
    ) = 6 THEN 'pass' ELSE 'fail' END AS status,
    'Foundation 010/011 ancora presente (6 tabelle)'::text AS expected,
    jsonb_build_object('foundation_table_count', (
      SELECT COUNT(*)::int FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN (
        'accounting_settings', 'accounting_fiscal_params', 'accounting_fiscal_years',
        'accounting_accounts', 'accounting_categories', 'accounting_payment_method_account_map'
      )
    )) AS actual,
    '{}'::jsonb AS details
),

t22_fn AS (
  SELECT p.proname AS function_name, p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('accounting_forbid_physical_delete', 'accounting_protect_audit_append_only')
),
t22_eval AS (
  SELECT
    CASE WHEN (SELECT COUNT(*) FROM t22_fn) = 2 THEN 'pass' ELSE 'fail' END AS status,
    'Funzioni protect: forbid_physical_delete + protect_audit_append_only'::text AS expected,
    jsonb_build_object('functions', COALESCE((SELECT JSONB_AGG(jsonb_build_object('function_name', function_name, 'proconfig', TO_JSONB(proconfig)) ORDER BY function_name) FROM t22_fn), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t23_idx AS (
  SELECT i.relname AS index_name, pg_get_indexdef(i.oid) AS index_def
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_class c ON c.oid = x.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'accounting_counterparties'
    AND x.indisunique AND pg_get_indexdef(i.oid) ILIKE '%people_id%'
),
t23_eval AS (
  SELECT
    CASE WHEN EXISTS (SELECT 1 FROM t23_idx) THEN 'pass' ELSE 'fail' END AS status,
    'Unique parziale people_id su counterparties'::text AS expected,
    jsonb_build_object('indexes', COALESCE((SELECT JSONB_AGG(jsonb_build_object('index_name', index_name, 'index_def', index_def)) FROM t23_idx), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t24_p AS (
  SELECT policyname, cmd, qual
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'accounting_movement_allocations' AND cmd = 'DELETE'
),
t24_eval AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM t24_p) = 1
       AND EXISTS (SELECT 1 FROM t24_p WHERE COALESCE(qual, '') ILIKE '%edit_draft%' AND COALESCE(qual, '') ILIKE '%draft%')
      THEN 'pass'
      ELSE 'fail'
    END AS status,
    'DELETE allocations solo bozze (edit_draft + draft/pending)'::text AS expected,
    jsonb_build_object('policies', COALESCE((SELECT JSONB_AGG(jsonb_build_object('policyname', policyname, 'using_expression', qual)) FROM t24_p), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
),

t25_fk AS (
  SELECT c.conname, c.conrelid::regclass::text AS on_table, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.accounting_movements'::regclass
    AND c.contype = 'f'
    AND c.conname IN ('accounting_movements_reverses_fk', 'accounting_movements_reversed_by_fk')
),
t25_eval AS (
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM t25_fk) = 2
       AND (SELECT COUNT(*) FROM t25_fk WHERE definition ILIKE '%ON DELETE RESTRICT%') = 2
      THEN 'pass'
      ELSE 'fail'
    END AS status,
    'Due self-FK movements ON DELETE RESTRICT'::text AS expected,
    jsonb_build_object('foreign_keys', COALESCE((SELECT JSONB_AGG(jsonb_build_object('conname', conname, 'on_table', on_table, 'definition', definition) ORDER BY conname) FROM t25_fk), '[]'::jsonb)) AS actual,
    '{}'::jsonb AS details
)

SELECT
  jsonb_build_object(
    'meta', jsonb_build_object(
      'report', 'accounting_core_012_T1_T25',
      'read_only', true,
      'modifies_data', false,
      'step_2d_authorized', false
    ),
    'T1',  jsonb_build_object('status', t1_eval.status,  'expected', t1_eval.expected,  'actual', t1_eval.actual,  'details', t1_eval.details),
    'T2',  jsonb_build_object('status', t2_eval.status,  'expected', t2_eval.expected,  'actual', t2_eval.actual,  'details', t2_eval.details),
    'T3',  jsonb_build_object('status', t3_eval.status,  'expected', t3_eval.expected,  'actual', t3_eval.actual,  'details', t3_eval.details),
    'T4',  jsonb_build_object('status', t4_eval.status,  'expected', t4_eval.expected,  'actual', t4_eval.actual,  'details', t4_eval.details),
    'T5',  jsonb_build_object('status', t5_eval.status,  'expected', t5_eval.expected,  'actual', t5_eval.actual,  'details', t5_eval.details),
    'T6',  jsonb_build_object('status', t6_eval.status,  'expected', t6_eval.expected,  'actual', t6_eval.actual,  'details', t6_eval.details),
    'T7',  jsonb_build_object('status', t7_eval.status,  'expected', t7_eval.expected,  'actual', t7_eval.actual,  'details', t7_eval.details),
    'T8',  jsonb_build_object('status', t8_eval.status,  'expected', t8_eval.expected,  'actual', t8_eval.actual,  'details', t8_eval.details),
    'T9',  jsonb_build_object('status', t9_eval.status,  'expected', t9_eval.expected,  'actual', t9_eval.actual,  'details', t9_eval.details),
    'T10', jsonb_build_object('status', t10_eval.status, 'expected', t10_eval.expected, 'actual', t10_eval.actual, 'details', t10_eval.details),
    'T11', jsonb_build_object('status', t11_eval.status, 'expected', t11_eval.expected, 'actual', t11_eval.actual, 'details', t11_eval.details),
    'T12', jsonb_build_object('status', t12_eval.status, 'expected', t12_eval.expected, 'actual', t12_eval.actual, 'details', t12_eval.details),
    'T13', jsonb_build_object('status', t13_eval.status, 'expected', t13_eval.expected, 'actual', t13_eval.actual, 'details', t13_eval.details),
    'T14', jsonb_build_object('status', t14_eval.status, 'expected', t14_eval.expected, 'actual', t14_eval.actual, 'details', t14_eval.details),
    'T15', jsonb_build_object('status', t15_eval.status, 'expected', t15_eval.expected, 'actual', t15_eval.actual, 'details', t15_eval.details),
    'T16', jsonb_build_object('status', t16_eval.status, 'expected', t16_eval.expected, 'actual', t16_eval.actual, 'details', t16_eval.details),
    'T17', jsonb_build_object('status', t17_eval.status, 'expected', t17_eval.expected, 'actual', t17_eval.actual, 'details', t17_eval.details),
    'T18', jsonb_build_object('status', t18_eval.status, 'expected', t18_eval.expected, 'actual', t18_eval.actual, 'details', t18_eval.details),
    'T19', jsonb_build_object('status', t19_eval.status, 'expected', t19_eval.expected, 'actual', t19_eval.actual, 'details', t19_eval.details),
    'T20', jsonb_build_object('status', t20_eval.status, 'expected', t20_eval.expected, 'actual', t20_eval.actual, 'details', t20_eval.details),
    'T21', jsonb_build_object('status', t21_eval.status, 'expected', t21_eval.expected, 'actual', t21_eval.actual, 'details', t21_eval.details),
    'T22', jsonb_build_object('status', t22_eval.status, 'expected', t22_eval.expected, 'actual', t22_eval.actual, 'details', t22_eval.details),
    'T23', jsonb_build_object('status', t23_eval.status, 'expected', t23_eval.expected, 'actual', t23_eval.actual, 'details', t23_eval.details),
    'T24', jsonb_build_object('status', t24_eval.status, 'expected', t24_eval.expected, 'actual', t24_eval.actual, 'details', t24_eval.details),
    'T25', jsonb_build_object('status', t25_eval.status, 'expected', t25_eval.expected, 'actual', t25_eval.actual, 'details', t25_eval.details)
  ) AS accounting_core_test_report
FROM t1_eval, t2_eval, t3_eval, t4_eval, t5_eval, t6_eval, t7_eval, t8_eval, t9_eval, t10_eval,
     t11_eval, t12_eval, t13_eval, t14_eval, t15_eval, t16_eval, t17_eval, t18_eval, t19_eval, t20_eval,
     t21_eval, t22_eval, t23_eval, t24_eval, t25_eval;
