-- =============================================================================
-- 019_accounting_category_settings_test_report.sql
-- Query UNICA READ-ONLY: consolida T1–T20 (+T14b/T16b/T17b/T20b) in un JSONB.
-- Nessun INSERT/UPDATE/DELETE/DDL/DO/RPC di scrittura.
-- =============================================================================

WITH checks AS (
  SELECT 'T1_groups_table'::text AS check_id,
    CASE WHEN to_regclass('public.accounting_category_groups') IS NOT NULL
      THEN 'PASS' ELSE 'FAIL' END AS status,
    jsonb_build_object(
      'ok', to_regclass('public.accounting_category_groups') IS NOT NULL
    ) AS detail

  UNION ALL SELECT 'T2_groups_columns',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE column_name IN (
        'id', 'direction', 'code', 'name', 'description',
        'is_active', 'is_system', 'sort_order',
        'created_at', 'created_by', 'updated_at', 'updated_by',
        'archived_at', 'archived_by'
      ))
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_category_groups'
    ) = 14 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('matched_cols', COUNT(*) FILTER (WHERE column_name IN (
        'id', 'direction', 'code', 'name', 'description',
        'is_active', 'is_system', 'sort_order',
        'created_at', 'created_by', 'updated_at', 'updated_by',
        'archived_at', 'archived_by'
      )), 'expected', 14)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_category_groups'
    )

  UNION ALL SELECT 'T3_categories_new_columns',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE column_name IN (
        'group_id', 'available_in_movements', 'available_in_budget',
        'available_in_reports', 'recommended_active'
      ))
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_categories'
    ) = 5 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('matched_cols', COUNT(*) FILTER (WHERE column_name IN (
        'group_id', 'available_in_movements', 'available_in_budget',
        'available_in_reports', 'recommended_active'
      )), 'expected', 5)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_categories'
    )

  UNION ALL SELECT 'T4_groups_unique',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_category_groups_direction_code_unique'
        AND conrelid = 'public.accounting_category_groups'::regclass
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'accounting_category_groups_direction_code_unique'
        AND conrelid = 'public.accounting_category_groups'::regclass
    ))

  UNION ALL SELECT 'T5_groups_direction_check',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_category_groups'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%income%'
        AND pg_get_constraintdef(c.oid) ILIKE '%expense%'
        AND pg_get_constraintdef(c.oid) NOT ILIKE '%both%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(pg_get_constraintdef(c.oid)), '[]'::jsonb)
      FROM pg_constraint c
      WHERE c.conrelid = 'public.accounting_category_groups'::regclass
        AND c.contype = 'c'
        AND pg_get_constraintdef(c.oid) ILIKE '%income%expense%'
    )

  UNION ALL SELECT 'T6_group_id_fk',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public' AND rel.relname = 'accounting_categories'
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) ILIKE '%group_id%'
        AND pg_get_constraintdef(c.oid) ILIKE '%accounting_category_groups%'
        AND pg_get_constraintdef(c.oid) ILIKE '%RESTRICT%'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public' AND rel.relname = 'accounting_categories'
        AND c.contype = 'f'
        AND pg_get_constraintdef(c.oid) ILIKE '%group_id%'
        AND pg_get_constraintdef(c.oid) ILIKE '%accounting_category_groups%'
        AND pg_get_constraintdef(c.oid) ILIKE '%RESTRICT%'
    ))

  UNION ALL SELECT 'T7_indexes',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE indexname IN (
        'idx_accounting_category_groups_direction',
        'idx_accounting_category_groups_is_active',
        'idx_accounting_category_groups_sort_order',
        'idx_accounting_categories_group_id'
      ))
      FROM pg_indexes WHERE schemaname = 'public'
    ) = 4 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('matched_indexes', COUNT(*) FILTER (WHERE indexname IN (
        'idx_accounting_category_groups_direction',
        'idx_accounting_category_groups_is_active',
        'idx_accounting_category_groups_sort_order',
        'idx_accounting_categories_group_id'
      )), 'expected', 4)
      FROM pg_indexes WHERE schemaname = 'public'
    )

  UNION ALL SELECT 'T8_trg_groups_updated_at',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'accounting_category_groups'
        AND t.tgname = 'trg_accounting_category_groups_updated_at'
        AND NOT t.tgisinternal
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'accounting_category_groups'
        AND t.tgname = 'trg_accounting_category_groups_updated_at'
        AND NOT t.tgisinternal
    ))

  UNION ALL SELECT 'T9_trg_groups_protect',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'accounting_category_groups'
        AND t.tgname = 'trg_accounting_category_groups_protect'
        AND NOT t.tgisinternal
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'accounting_category_groups'
        AND t.tgname = 'trg_accounting_category_groups_protect'
        AND NOT t.tgisinternal
    ))

  UNION ALL SELECT 'T10_trg_category_coherence',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'accounting_categories'
        AND t.tgname = 'trg_accounting_category_enforce_group_coherence'
        AND NOT t.tgisinternal
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'accounting_categories'
        AND t.tgname = 'trg_accounting_category_enforce_group_coherence'
        AND NOT t.tgisinternal
    ))

  UNION ALL SELECT 'T11_rls',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('accounting_category_groups', 'accounting_categories')
        AND c.relrowsecurity
    ) = 2 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'relname', c.relname, 'rls_enabled', c.relrowsecurity
      ) ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('accounting_category_groups', 'accounting_categories')
    )

  UNION ALL SELECT 'T12_anon_privs',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('accounting_category_groups', 'accounting_categories')
        AND grantee = 'anon'
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('anon_grants', COUNT(*))
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('accounting_category_groups', 'accounting_categories')
        AND grantee = 'anon'
    )

  UNION ALL SELECT 'T13_authenticated_grants',
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_category_groups'
          AND grantee='authenticated' AND privilege_type='SELECT')
      AND EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_category_groups'
          AND grantee='authenticated' AND privilege_type='INSERT')
      AND EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_category_groups'
          AND grantee='authenticated' AND privilege_type='UPDATE')
      AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_category_groups'
          AND grantee='authenticated' AND privilege_type='DELETE')
      AND EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_categories'
          AND grantee='authenticated' AND privilege_type='SELECT')
      AND EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_categories'
          AND grantee='authenticated' AND privilege_type='INSERT')
      AND EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_categories'
          AND grantee='authenticated' AND privilege_type='UPDATE')
      AND NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants
        WHERE table_schema='public' AND table_name='accounting_categories'
          AND grantee='authenticated' AND privilege_type='DELETE')
      THEN 'PASS' ELSE 'FAIL'
    END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table_name', table_name, 'privilege_type', privilege_type
      ) ORDER BY table_name, privilege_type), '[]'::jsonb)
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('accounting_category_groups', 'accounting_categories')
        AND grantee = 'authenticated'
    )

  UNION ALL SELECT 'T14_policies',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('accounting_category_groups', 'accounting_categories')
    ) >= 6 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'tablename', tablename, 'policyname', policyname, 'cmd', cmd
      ) ORDER BY tablename, policyname), '[]'::jsonb)
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('accounting_category_groups', 'accounting_categories')
    )

  UNION ALL SELECT 'T14b_no_delete_policy',
    CASE WHEN (
      SELECT COUNT(*) FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('accounting_category_groups', 'accounting_categories')
        AND cmd = 'DELETE'
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object('delete_policies', COUNT(*))
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('accounting_category_groups', 'accounting_categories')
        AND cmd = 'DELETE'
    )

  UNION ALL SELECT 'T15_quote_mapping',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.accounting_categories c
      LEFT JOIN public.accounting_category_groups g ON g.id = c.group_id
      WHERE upper(c.code) = 'QUOTE'
        AND c.is_active IS TRUE
        AND COALESCE(c.recommended_active, false) IS TRUE
        AND g.code = 'QUOTE_SPORT'
    ) THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id, 'code', c.code, 'is_active', c.is_active,
        'recommended_active', c.recommended_active,
        'group_code', g.code, 'group_direction', g.direction,
        'default_nature', c.default_nature,
        'include_in_commercial_limit', c.include_in_commercial_limit
      )), '[]'::jsonb)
      FROM public.accounting_categories c
      LEFT JOIN public.accounting_category_groups g ON g.id = c.group_id
      WHERE upper(c.code) = 'QUOTE'
    )

  UNION ALL SELECT 'T16_system_groups',
    CASE WHEN (
      SELECT COUNT(*) FROM public.accounting_category_groups WHERE is_system IS TRUE
    ) = 11 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'system_groups', COUNT(*),
        'expected', 11
      )
      FROM public.accounting_category_groups WHERE is_system IS TRUE
    )

  UNION ALL SELECT 'T16b_group_codes',
    'REVIEW',
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'direction', direction, 'code', code, 'sort_order', sort_order
      ) ORDER BY direction, sort_order, code), '[]'::jsonb)
      FROM public.accounting_category_groups
      WHERE is_system IS TRUE
    )

  UNION ALL SELECT 'T17_legacy_map',
    CASE WHEN (
      SELECT COUNT(*) FROM public.accounting_categories
      WHERE upper(code) IN ('ALTRE_ENTRATE', 'ALTRE_USCITE')
        AND group_id IS NOT NULL
    ) >= 2 THEN 'PASS' ELSE 'REVIEW' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', c.code, 'group_code', g.code
      ) ORDER BY c.code), '[]'::jsonb)
      FROM public.accounting_categories c
      LEFT JOIN public.accounting_category_groups g ON g.id = c.group_id
      WHERE upper(c.code) IN ('ALTRE_ENTRATE', 'ALTRE_USCITE', 'SPONSOR', 'SPONSORIZZAZIONI')
    )

  UNION ALL SELECT 'T17b_sponsor_no_dup',
    CASE WHEN (
      SELECT COUNT(*) FILTER (WHERE upper(code) = 'SPONSOR')
           + COUNT(*) FILTER (WHERE upper(code) = 'SPONSORIZZAZIONI')
      FROM public.accounting_categories
    ) BETWEEN 1 AND 2 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'sponsor_n', COUNT(*) FILTER (WHERE upper(code) = 'SPONSOR'),
        'sponsorizzazioni_n', COUNT(*) FILTER (WHERE upper(code) = 'SPONSORIZZAZIONI')
      )
      FROM public.accounting_categories
    )

  UNION ALL SELECT 'T18_functions',
    CASE WHEN (
      SELECT COUNT(DISTINCT p.proname) FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
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
    ) = 10 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'proname', p.proname,
        'security_definer', p.prosecdef
      ) ORDER BY p.proname), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN (
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
    )

  UNION ALL SELECT 'T19_fn_execute_anon',
    CASE WHEN (
      SELECT COUNT(*) FROM information_schema.routine_privileges
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
    ) = 0 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT jsonb_build_object(
        'bad_grants', COALESCE(jsonb_agg(jsonb_build_object(
          'routine_name', routine_name, 'grantee', grantee
        )), '[]'::jsonb)
      )
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
    )

  UNION ALL SELECT 'T20_recommended_active_col',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_categories'
        AND column_name = 'recommended_active'
    ) THEN 'PASS' ELSE 'FAIL' END,
    jsonb_build_object('ok', EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounting_categories'
        AND column_name = 'recommended_active'
    ))

  UNION ALL SELECT 'T20b_catalog_sample',
    CASE WHEN (
      SELECT COUNT(*) FROM public.accounting_categories c
      WHERE upper(c.code) IN (
        'QUOTE', 'PUBBLICITA', 'BIGLIETTERIA', 'MATERIALE_SPORTIVO',
        'MERCHANDISING', 'ARBITRI', 'AMMORTAMENTI'
      )
      AND (
        (upper(c.code) IN ('QUOTE', 'PUBBLICITA', 'BIGLIETTERIA', 'MATERIALE_SPORTIVO')
          AND c.is_active IS TRUE AND c.recommended_active IS TRUE)
        OR (upper(c.code) IN ('MERCHANDISING', 'ARBITRI', 'AMMORTAMENTI')
          AND c.is_active IS FALSE AND c.recommended_active IS FALSE)
      )
    ) = 7 THEN 'PASS' ELSE 'FAIL' END,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', code, 'is_active', is_active,
        'recommended_active', recommended_active,
        'default_nature', default_nature,
        'include_in_commercial_limit', include_in_commercial_limit
      ) ORDER BY code), '[]'::jsonb)
      FROM public.accounting_categories
      WHERE upper(code) IN (
        'QUOTE', 'PUBBLICITA', 'BIGLIETTERIA', 'MATERIALE_SPORTIVO',
        'MERCHANDISING', 'ARBITRI', 'AMMORTAMENTI'
      )
    )
),
summary AS (
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'PASS')::int AS passed,
    COUNT(*) FILTER (WHERE status = 'FAIL')::int AS failed,
    COUNT(*) FILTER (WHERE status = 'REVIEW')::int AS review
  FROM checks
)
SELECT jsonb_build_object(
  'meta', jsonb_build_object(
    'read_only', true,
    'modifies_data', false,
    'suite', '019_accounting_category_settings',
    'checks', 'T1-T20'
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
        'check_id', c.check_id,
        'status', c.status,
        'detail', c.detail
      ) ORDER BY c.check_id
    ), '[]'::jsonb)
    FROM checks c
  )
) AS report
FROM summary s;
