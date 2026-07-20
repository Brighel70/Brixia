-- =============================================================================
-- 018_accounting_commercial_vat_test_report.sql
-- =============================================================================
-- Query UNICA READ-ONLY: consolida T1–T35 in un unico JSONB.
-- NON modifica dati. Nessun INSERT/UPDATE/DELETE/DDL/DO/RPC di scrittura.
-- Helper IMMUTABLE/STABLE (vat_from_taxable, round, indicative_due) = sola lettura.
-- =============================================================================

WITH
checks AS (
  SELECT * FROM (
    VALUES
    -- T1
    (
      'T1_tables'::text,
      CASE
        WHEN to_regclass('public.accounting_commercial_documents') IS NOT NULL
         AND to_regclass('public.accounting_commercial_document_payments') IS NOT NULL
         AND to_regclass('public.accounting_vat_periods') IS NOT NULL
        THEN 'PASS' ELSE 'FAIL'
      END,
      jsonb_build_object(
        'documents_ok', to_regclass('public.accounting_commercial_documents') IS NOT NULL,
        'payments_ok', to_regclass('public.accounting_commercial_document_payments') IS NOT NULL,
        'vat_periods_ok', to_regclass('public.accounting_vat_periods') IS NOT NULL
      )::text
    )
  ) AS t(check_id, status, detail)

  UNION ALL SELECT
    'T2_doc_columns',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE column_name IN (
        'id', 'fiscal_year_id', 'counterparty_id', 'document_type', 'document_number',
        'document_date', 'description', 'commercial_kind',
        'taxable_amount_cents', 'vat_rate_basis_points', 'vat_amount_cents',
        'gross_amount_cents', 'status', 'movement_id', 'include_in_398_limit',
        'notes', 'issued_at', 'issued_by', 'collected_at', 'collected_by',
        'cancelled_at', 'cancelled_by', 'created_at', 'created_by',
        'updated_at', 'updated_by'
      ))
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_commercial_documents'
    ) = 26 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('matched_cols', COUNT(*) FILTER (WHERE column_name IN (
        'id', 'fiscal_year_id', 'counterparty_id', 'document_type', 'document_number',
        'document_date', 'description', 'commercial_kind',
        'taxable_amount_cents', 'vat_rate_basis_points', 'vat_amount_cents',
        'gross_amount_cents', 'status', 'movement_id', 'include_in_398_limit',
        'notes', 'issued_at', 'issued_by', 'collected_at', 'collected_by',
        'cancelled_at', 'cancelled_by', 'created_at', 'created_by',
        'updated_at', 'updated_by'
      )), 'expected', 26)::text
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_commercial_documents'
    )

  UNION ALL SELECT
    'T3_payment_columns',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE column_name IN (
        'id', 'document_id', 'movement_id', 'allocated_amount_cents',
        'notes', 'created_at', 'created_by'
      ))
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_commercial_document_payments'
    ) = 7 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('matched_cols', COUNT(*) FILTER (WHERE column_name IN (
        'id', 'document_id', 'movement_id', 'allocated_amount_cents',
        'notes', 'created_at', 'created_by'
      )), 'expected', 7)::text
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_commercial_document_payments'
    )

  UNION ALL SELECT
    'T4_vat_columns',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE column_name IN (
        'id', 'fiscal_year_id', 'year', 'quarter', 'status',
        'commercial_taxable_cents', 'output_vat_cents', 'forfait_deduction_cents',
        'estimated_vat_due_cents', 'indicative_due_on',
        'verified_at', 'verified_by', 'paid_at', 'payment_reference',
        'param_snapshot', 'created_at', 'created_by', 'updated_at', 'updated_by'
      ))
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_vat_periods'
    ) = 19 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('matched_cols', COUNT(*) FILTER (WHERE column_name IN (
        'id', 'fiscal_year_id', 'year', 'quarter', 'status',
        'commercial_taxable_cents', 'output_vat_cents', 'forfait_deduction_cents',
        'estimated_vat_due_cents', 'indicative_due_on',
        'verified_at', 'verified_by', 'paid_at', 'payment_reference',
        'param_snapshot', 'created_at', 'created_by', 'updated_at', 'updated_by'
      )), 'expected', 19)::text
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_vat_periods'
    )

  UNION ALL SELECT
    'T5_status_partially_collected',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%partially_collected%'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%partially_collected%'
        AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    ))::text

  UNION ALL SELECT
    'T6_gross_check',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_commercial_documents_gross_equals_parts'
        AND conrelid = 'public.accounting_commercial_documents'::regclass
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_commercial_documents_gross_equals_parts'
        AND conrelid = 'public.accounting_commercial_documents'::regclass
    ))::text

  UNION ALL SELECT
    'T7_payments_unique',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_commercial_document_payments_doc_mov_unique'
        AND conrelid = 'public.accounting_commercial_document_payments'::regclass
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_commercial_document_payments_doc_mov_unique'
        AND conrelid = 'public.accounting_commercial_document_payments'::regclass
    ))::text

  UNION ALL SELECT
    'T8_vat_unique',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_vat_periods_fy_year_quarter_unique'
        AND conrelid = 'public.accounting_vat_periods'::regclass
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_vat_periods_fy_year_quarter_unique'
        AND conrelid = 'public.accounting_vat_periods'::regclass
    ))::text

  UNION ALL SELECT
    'T9_no_legacy_movement_unique',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_accounting_commercial_documents_movement'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('legacy_unique_absent', NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_accounting_commercial_documents_movement'
    ))::text

  UNION ALL SELECT
    'T10_indexes',
    CASE WHEN
      (
        SELECT COUNT(*) FILTER (WHERE indexname IN (
          'idx_accounting_commercial_documents_fiscal_year',
          'idx_accounting_commercial_documents_document_date',
          'idx_accounting_commercial_documents_status',
          'idx_accounting_commercial_documents_commercial_kind',
          'idx_accounting_commercial_documents_counterparty'
        ))
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'accounting_commercial_documents'
      ) = 5
      AND (
        SELECT COUNT(*) FILTER (WHERE indexname IN (
          'idx_accounting_commercial_document_payments_document',
          'idx_accounting_commercial_document_payments_movement'
        ))
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'accounting_commercial_document_payments'
      ) = 2
    THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'doc_indexes', (
          SELECT COUNT(*) FILTER (WHERE indexname IN (
            'idx_accounting_commercial_documents_fiscal_year',
            'idx_accounting_commercial_documents_document_date',
            'idx_accounting_commercial_documents_status',
            'idx_accounting_commercial_documents_commercial_kind',
            'idx_accounting_commercial_documents_counterparty'
          ))
          FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'accounting_commercial_documents'
        ),
        'payment_indexes', (
          SELECT COUNT(*) FILTER (WHERE indexname IN (
            'idx_accounting_commercial_document_payments_document',
            'idx_accounting_commercial_document_payments_movement'
          ))
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'accounting_commercial_document_payments'
        ),
        'expected_doc', 5,
        'expected_payment', 2
      )::text
    )

  UNION ALL SELECT
    'T11_rls',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
        AND c.relrowsecurity
    ) = 3 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'relname', c.relname,
        'rls_enabled', c.relrowsecurity
      ) ORDER BY c.relname), '[]'::jsonb)::text
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
    )

  UNION ALL SELECT
    'T12_policies',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
    ) >= 5 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tablename', tablename,
        'policyname', policyname,
        'cmd', cmd
      ) ORDER BY tablename, policyname), '[]'::jsonb)::text
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
    )

  UNION ALL SELECT
    'T13_anon_table_privs',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
        AND grantee = 'anon'
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('anon_grants', COUNT(*))::text
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
        AND grantee = 'anon'
    )

  UNION ALL SELECT
    'T14_authenticated_grants',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'accounting_commercial_documents'
          AND grantee = 'authenticated' AND privilege_type = 'SELECT'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'accounting_commercial_documents'
          AND grantee = 'authenticated' AND privilege_type = 'INSERT'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'accounting_commercial_documents'
          AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'accounting_commercial_documents'
          AND grantee = 'authenticated' AND privilege_type = 'DELETE'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = 'accounting_commercial_document_payments'
          AND grantee = 'authenticated' AND privilege_type = 'SELECT'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND table_name = 'accounting_commercial_document_payments'
          AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'accounting_vat_periods'
          AND grantee = 'authenticated' AND privilege_type = 'SELECT'
      )
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema = 'public' AND table_name = 'accounting_vat_periods'
          AND grantee = 'authenticated' AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
      )
      THEN 'PASS' ELSE 'FAIL'
    END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table_name', table_name,
        'privilege_type', privilege_type
      ) ORDER BY table_name, privilege_type), '[]'::jsonb)::text
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN (
          'accounting_commercial_documents',
          'accounting_commercial_document_payments',
          'accounting_vat_periods'
        )
        AND grantee = 'authenticated'
    )

  UNION ALL SELECT
    'T15_functions',
    CASE WHEN (
      SELECT COUNT(DISTINCT p.proname)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
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
        )
    ) = 17
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'accounting_commercial_doc_collect'
    )
    THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'matched_fns', COUNT(DISTINCT p.proname),
        'expected', 17,
        'legacy_collect_still_exists', EXISTS (
          SELECT 1 FROM pg_proc p2
          JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
          WHERE n2.nspname = 'public' AND p2.proname = 'accounting_commercial_doc_collect'
        )
      )::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
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
        )
    )

  UNION ALL SELECT
    'T16_rpc_security',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_proc p
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
        AND p.prosecdef
        AND EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
          WHERE cfg ILIKE 'search_path=pg_catalog, public'
             OR cfg ILIKE 'search_path="pg_catalog", "public"'
        )
    ) = 7 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'proname', p.proname,
        'security_definer', p.prosecdef,
        'proconfig', (
          SELECT string_agg(cfg, ',' ORDER BY cfg)
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
        )
      ) ORDER BY p.proname), '[]'::jsonb)::text
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
    )

  UNION ALL SELECT
    'T17_fn_execute_anon',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.routine_privileges
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
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'bad_grants', COALESCE(jsonb_agg(jsonb_build_object(
          'routine_name', routine_name,
          'grantee', grantee,
          'privilege_type', privilege_type
        )), '[]'::jsonb)
      )::text
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
    )

  UNION ALL SELECT
    'T18_triggers',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
        AND (
          (
            c.relname IN ('accounting_commercial_documents', 'accounting_vat_periods')
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
    ) = 7 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table_name', c.relname,
        'tgname', t.tgname,
        'function_name', p.proname
      ) ORDER BY c.relname, t.tgname), '[]'::jsonb)::text
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
        AND (
          (
            c.relname IN ('accounting_commercial_documents', 'accounting_vat_periods')
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
    )

  UNION ALL SELECT
    'T19_sponsor_category',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.accounting_categories
        WHERE upper(code) = 'SPONSOR'
          AND direction = 'income'
          AND default_nature = 'commercial'
          AND include_in_commercial_limit IS TRUE
          AND is_system IS TRUE
      ) THEN 'PASS'
      WHEN EXISTS (
        SELECT 1 FROM public.accounting_categories
        WHERE upper(code) IN ('SPONSOR', 'SPONSORIZZAZIONI')
      ) THEN 'REVIEW'
      ELSE 'FAIL'
    END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', code,
        'name', name,
        'direction', direction,
        'default_nature', default_nature,
        'include_in_commercial_limit', include_in_commercial_limit,
        'is_system', is_system,
        'is_active', is_active,
        'sort_order', sort_order
      ) ORDER BY CASE WHEN upper(code) = 'SPONSOR' THEN 0 ELSE 1 END), '[]'::jsonb)::text
      FROM public.accounting_categories
      WHERE upper(code) IN ('SPONSOR', 'SPONSORIZZAZIONI')
    )

  UNION ALL SELECT
    'T20_vat_math',
    CASE WHEN
      public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent') = 220000
      AND public.accounting_round_half_up_cents((220000::numeric * 50) / 100.0) = 110000
      AND GREATEST(
            0,
            220000 - public.accounting_round_half_up_cents((220000::numeric * 50) / 100.0)
          ) = 110000
    THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'vat_cents', public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent'),
      'forfait_cents', public.accounting_round_half_up_cents((220000::numeric * 50) / 100.0),
      'due_cents', GREATEST(
        0,
        220000 - public.accounting_round_half_up_cents((220000::numeric * 50) / 100.0)
      ),
      'expected', jsonb_build_object('vat', 220000, 'forfait', 110000, 'due', 110000)
    )::text

  UNION ALL SELECT
    'T21_indicative_due',
    CASE WHEN
      public.accounting_vat_indicative_due_on(2026, 1) = DATE '2026-05-16'
      AND public.accounting_vat_indicative_due_on(2026, 2) = DATE '2026-08-20'
      AND public.accounting_vat_indicative_due_on(2026, 3) = DATE '2026-11-16'
      AND public.accounting_vat_indicative_due_on(2026, 4) = DATE '2027-02-16'
    THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'q1', public.accounting_vat_indicative_due_on(2026, 1),
      'q2', public.accounting_vat_indicative_due_on(2026, 2),
      'q3', public.accounting_vat_indicative_due_on(2026, 3),
      'q4', public.accounting_vat_indicative_due_on(2026, 4)
    )::text

  UNION ALL SELECT
    'T22_doc_checks',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE contype = 'c')
      FROM pg_constraint
      WHERE conrelid = 'public.accounting_commercial_documents'::regclass
    ) >= 5 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'named_checks', COUNT(*) FILTER (WHERE contype = 'c'),
        'expected_min', 5
      )::text
      FROM pg_constraint
      WHERE conrelid = 'public.accounting_commercial_documents'::regclass
    )

  UNION ALL SELECT
    'T23_quarter_check',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.accounting_vat_periods'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%quarter%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.accounting_vat_periods'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%quarter%'
    ))::text

  UNION ALL SELECT
    'T24_fiscal_param_keys',
    CASE
      WHEN (
        SELECT COUNT(DISTINCT param_key)
        FROM public.accounting_fiscal_params
        WHERE param_key IN (
          'commercial_revenue_limit',
          'vat_flat_deduction_pct',
          'vat_periodicity',
          'vat_rate_sponsorship',
          'vat_rounding_method'
        )
      ) = 5 THEN 'PASS'
      WHEN (
        SELECT COUNT(DISTINCT param_key)
        FROM public.accounting_fiscal_params
        WHERE param_key IN (
          'commercial_revenue_limit',
          'vat_flat_deduction_pct',
          'vat_periodicity',
          'vat_rate_sponsorship',
          'vat_rounding_method'
        )
      ) > 0 THEN 'REVIEW'
      ELSE 'FAIL'
    END,
    (
      SELECT jsonb_build_object(
        'expected_keys_from_010', ARRAY[
          'commercial_revenue_limit',
          'vat_flat_deduction_pct',
          'vat_periodicity',
          'vat_rate_sponsorship',
          'vat_rounding_method'
        ],
        'present_in_db', COALESCE((
          SELECT array_agg(DISTINCT p.param_key ORDER BY p.param_key)
          FROM public.accounting_fiscal_params p
          WHERE p.param_key IN (
            'commercial_revenue_limit',
            'vat_flat_deduction_pct',
            'vat_periodicity',
            'vat_rate_sponsorship',
            'vat_rounding_method'
          )
        ), ARRAY[]::text[])
      )::text
    )

  UNION ALL SELECT
    'T25_comments',
    CASE
      WHEN COALESCE((
        SELECT col_description('public.accounting_commercial_documents'::regclass, a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
          AND a.attname = 'movement_id' AND NOT a.attisdropped
      ), '') ILIKE '%deprecated%'
      AND COALESCE((
        SELECT col_description('public.accounting_commercial_documents'::regclass, a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
          AND a.attname = 'document_date' AND NOT a.attisdropped
      ), '') ILIKE '%impositiv%'
      THEN 'PASS'
      WHEN COALESCE((
        SELECT col_description('public.accounting_commercial_documents'::regclass, a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
          AND a.attname = 'movement_id' AND NOT a.attisdropped
      ), '') <> ''
      OR COALESCE((
        SELECT col_description('public.accounting_commercial_documents'::regclass, a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
          AND a.attname = 'document_date' AND NOT a.attisdropped
      ), '') <> ''
      THEN 'REVIEW'
      ELSE 'FAIL'
    END,
    (
      SELECT jsonb_build_object(
        'movement_id_comment_prefix', LEFT(COALESCE((
          SELECT col_description('public.accounting_commercial_documents'::regclass, a.attnum)
          FROM pg_attribute a
          WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
            AND a.attname = 'movement_id' AND NOT a.attisdropped
        ), ''), 80),
        'document_date_comment_prefix', LEFT(COALESCE((
          SELECT col_description('public.accounting_commercial_documents'::regclass, a.attnum)
          FROM pg_attribute a
          WHERE a.attrelid = 'public.accounting_commercial_documents'::regclass
            AND a.attname = 'document_date' AND NOT a.attisdropped
        ), ''), 80)
      )::text
    )

  UNION ALL SELECT
    'T26_vat_rate_bp_max_10000',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
        AND pg_get_constraintdef(c.oid) ILIKE '%10000%'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%100000%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
        AND pg_get_constraintdef(c.oid) ILIKE '%100000%'
    )
    THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'bp_check_ok', EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
          AND pg_get_constraintdef(c.oid) ILIKE '%10000%'
          AND pg_get_constraintdef(c.oid) NOT ILIKE '%100000%'
      ),
      'no_legacy_100000', NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        WHERE c.conrelid = 'public.accounting_commercial_documents'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%vat_rate_basis_points%'
          AND pg_get_constraintdef(c.oid) ILIKE '%100000%'
      )
    )::text

  UNION ALL SELECT
    'T27_unique_document_number',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_accounting_commercial_documents_number_active'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%btrim%'
        AND (indexdef ILIKE '%cancelled%' OR indexdef ILIKE '%cancel%')
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'index_exists', EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'uq_accounting_commercial_documents_number_active'
        ),
        'indexdef', (
          SELECT indexdef FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'uq_accounting_commercial_documents_number_active'
        )
      )::text
    )

  UNION ALL SELECT
    'T28_issue_guards_in_prosrc',
    CASE WHEN (
      SELECT
        (p.prosrc ILIKE '%document_type%invoice%' OR p.prosrc ILIKE '%invoice%')
        AND (p.prosrc ILIKE '%document_number%')
        AND (p.prosrc ILIKE '%accounting_vat_from_taxable%')
        AND (p.prosrc ILIKE '%vat_rounding_method%')
        AND (p.prosrc ILIKE '%manage_settings%')
        AND (p.prosrc ILIKE '%duplicat%' OR p.prosrc ILIKE '%btrim%')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'accounting_commercial_doc_issue'
      LIMIT 1
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'mentions_invoice', (p.prosrc ILIKE '%invoice%'),
        'mentions_number', (p.prosrc ILIKE '%document_number%'),
        'mentions_vat_math', (p.prosrc ILIKE '%accounting_vat_from_taxable%'),
        'mentions_rounding_param', (p.prosrc ILIKE '%vat_rounding_method%'),
        'mentions_rate_override_perm', (p.prosrc ILIKE '%manage_settings%'),
        'mentions_dup_or_btrim', (p.prosrc ILIKE '%duplicat%' OR p.prosrc ILIKE '%btrim%')
      )::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'accounting_commercial_doc_issue'
      LIMIT 1
    )

  UNION ALL SELECT
    'T29_cancel_guards_in_prosrc',
    CASE WHEN (
      SELECT
        (p.prosrc ILIKE '%partially_collected%')
        AND (p.prosrc ILIKE '%accounting_commercial_doc_collected_cents%')
        AND (p.prosrc ILIKE '%edit_draft%')
        AND (p.prosrc ILIKE '%accounting.post%')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'accounting_commercial_doc_cancel'
      LIMIT 1
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'blocks_partial', (p.prosrc ILIKE '%partially_collected%'),
        'mentions_collected', (p.prosrc ILIKE '%collected%'),
        'checks_effective', (p.prosrc ILIKE '%accounting_commercial_doc_collected_cents%'),
        'draft_perm', (p.prosrc ILIKE '%edit_draft%'),
        'post_perm', (p.prosrc ILIKE '%accounting.post%')
      )::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'accounting_commercial_doc_cancel'
      LIMIT 1
    )

  UNION ALL SELECT
    'T30_helpers_no_authenticated_execute',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.routine_privileges
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
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'leaked_execute', COALESCE(jsonb_agg(jsonb_build_object(
          'routine_name', routine_name,
          'grantee', grantee
        ) ORDER BY routine_name), '[]'::jsonb)
      )::text
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
    )

  UNION ALL SELECT
    'T31_public_rpc_authenticated_execute',
    CASE WHEN (
      SELECT COUNT(*) FROM (
        SELECT routine_name
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
          AND grantee = 'authenticated'
          AND privilege_type = 'EXECUTE'
        GROUP BY routine_name
      ) x
    ) = 7 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'routine_name', x.routine_name,
        'auth_exec', x.auth_exec
      ) ORDER BY x.routine_name), '[]'::jsonb)::text
      FROM (
        SELECT
          routine_name,
          COUNT(*) FILTER (
            WHERE grantee = 'authenticated' AND privilege_type = 'EXECUTE'
          ) AS auth_exec
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
      ) x
    )

  UNION ALL SELECT
    'T32_register_payment_guards',
    CASE WHEN (
      SELECT
        (p.prosrc ILIKE '%is_active%')
        AND (p.prosrc ILIKE '%open%')
        AND (p.prosrc ILIKE '%starts_on%' AND p.prosrc ILIKE '%ends_on%')
        AND (p.prosrc ILIKE '%EUR%')
        AND (p.prosrc ILIKE '%SPONSOR%')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'accounting_commercial_doc_register_payment'
      LIMIT 1
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'checks_account_active', (p.prosrc ILIKE '%is_active%'),
        'checks_fy_open', (p.prosrc ILIKE '%open%'),
        'checks_date_in_fy', (p.prosrc ILIKE '%starts_on%' AND p.prosrc ILIKE '%ends_on%'),
        'checks_eur', (p.prosrc ILIKE '%EUR%'),
        'checks_sponsor_cat', (p.prosrc ILIKE '%SPONSOR%')
      )::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'accounting_commercial_doc_register_payment'
      LIMIT 1
    )

  UNION ALL SELECT
    'T33_link_movement_guards',
    CASE WHEN (
      SELECT
        (p.prosrc ILIKE '%posted%')
        AND (p.prosrc ILIKE '%income%')
        AND (p.prosrc ILIKE '%account_id%')
        AND (p.prosrc ILIKE '%disponibile%' OR p.prosrc ILIKE '%allocated%')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'accounting_commercial_doc_link_movement'
      LIMIT 1
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'requires_posted', (p.prosrc ILIKE '%posted%'),
        'requires_income', (p.prosrc ILIKE '%income%'),
        'requires_account', (p.prosrc ILIKE '%account_id%'),
        'checks_available', (p.prosrc ILIKE '%disponibile%' OR p.prosrc ILIKE '%allocated%')
      )::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'accounting_commercial_doc_link_movement'
      LIMIT 1
    )

  UNION ALL SELECT
    'T34_vat_math_coherence',
    CASE WHEN
      public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent') = 220000
      AND (1000000 + public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent')) = 1220000
    THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object(
      'expected_vat', public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent'),
      'expected_gross', 1000000 + public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent'),
      'formula_ok',
        public.accounting_vat_from_taxable(1000000, 2200, 'half_up_cent') = 220000
        AND (1000000 + 220000) = 1220000
    )::text

  UNION ALL SELECT
    'T35_sponsor_category_helper',
    CASE WHEN (
      SELECT
        (p.prosrc ILIKE '%SPONSOR%')
        AND (p.prosrc ILIKE '%is_active%')
        AND (p.prosrc NOT ILIKE '%ALTRE_ENTRATE%')
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'accounting_commercial_preferred_income_category_id'
      LIMIT 1
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'mentions_sponsor', (p.prosrc ILIKE '%SPONSOR%'),
        'requires_active', (p.prosrc ILIKE '%is_active%'),
        'no_altre_entrate_fallback', (p.prosrc NOT ILIKE '%ALTRE_ENTRATE%')
      )::text
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'accounting_commercial_preferred_income_category_id'
      LIMIT 1
    )
),
normalized AS (
  SELECT
    check_id,
    status,
    CASE
      WHEN detail IS NULL THEN 'null'::jsonb
      WHEN left(btrim(detail), 1) IN ('{', '[') THEN detail::jsonb
      ELSE to_jsonb(detail)
    END AS detail
  FROM checks
),
summary AS (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'PASS')::int AS passed,
    COUNT(*) FILTER (WHERE status = 'FAIL')::int AS failed,
    COUNT(*) FILTER (WHERE status = 'REVIEW')::int AS review
  FROM normalized
)
SELECT jsonb_build_object(
  'meta', jsonb_build_object(
    'read_only', true,
    'modifies_data', false,
    'suite', '018_accounting_commercial_vat',
    'checks', 'T1-T35'
  ),
  'summary', jsonb_build_object(
    'total', s.total,
    'passed', s.passed,
    'failed', s.failed,
    'review', s.review
  ),
  'results', (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'check_id', n.check_id,
        'status', n.status,
        'detail', n.detail
      )
      ORDER BY n.check_id
    ), '[]'::jsonb)
    FROM normalized n
  )
) AS report
FROM summary s;
