-- =============================================================================
-- 053 - Verifica accesso catalogo Quote club-wide
-- Da eseguire DOPO 053_fix_fees_catalog_club_wide_access.sql
-- =============================================================================

SELECT jsonb_build_object(
  'check_id', 'T1_fix_fees_catalog_club_wide',
  'can_view_fee_uses_club_wide', EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'can_view_fee'
      AND pg_get_functiondef(p.oid) LIKE '%has_club_wide_operational_scope%'
  ),
  'can_manage_fees_uses_club_wide', EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'can_manage_fees'
      AND pg_get_functiondef(p.oid) LIKE '%has_club_wide_operational_scope%'
  ),
  'anon_execute_grants', (
    SELECT count(*)::int
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND grantee = 'anon'
      AND privilege_type = 'EXECUTE'
      AND routine_name IN ('can_view_fee', 'can_manage_fees')
  ),
  'all_checks_passed',
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'can_view_fee'
        AND pg_get_functiondef(p.oid) LIKE '%has_club_wide_operational_scope%'
    )
    AND EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'can_manage_fees'
        AND pg_get_functiondef(p.oid) LIKE '%has_club_wide_operational_scope%'
    )
) AS audit;
