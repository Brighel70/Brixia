-- =============================================================================
-- 047 - Verifica struttura ciclo di vita Prima nota
-- Da eseguire DOPO 047_accounting_movement_lifecycle.sql
-- =============================================================================

WITH required_functions(function_name) AS (
  VALUES
    ('accounting_post_manual_movement'),
    ('accounting_cancel_manual_movement'),
    ('accounting_reverse_manual_movement'),
    ('accounting_assign_pending_account'),
    ('accounting_create_manual_transfer'),
    ('accounting_update_manual_transfer')
),
function_audit AS (
  SELECT
    required.function_name,
    EXISTS (
      SELECT 1
      FROM pg_proc proc
      JOIN pg_namespace ns ON ns.oid = proc.pronamespace
      WHERE ns.nspname = 'public'
        AND proc.proname = required.function_name
    ) AS function_exists
  FROM required_functions required
)
SELECT jsonb_build_object(
  'check_id', 'T1_accounting_movement_lifecycle',
  'all_lifecycle_functions_present', bool_and(function_exists),
  'transfer_destination_column_present', EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounting_movements'
      AND column_name = 'transfer_account_id'
  ),
  'technical_transfer_category_present', EXISTS (
    SELECT 1
    FROM public.accounting_categories
    WHERE code = 'GIROCONTO'
      AND archived_at IS NULL
      AND available_in_movements IS FALSE
      AND available_in_budget IS FALSE
      AND available_in_reports IS FALSE
  ),
  'all_checks_passed', bool_and(function_exists)
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'accounting_movements'
        AND column_name = 'transfer_account_id'
    )
    AND EXISTS (
      SELECT 1
      FROM public.accounting_categories
      WHERE code = 'GIROCONTO'
        AND archived_at IS NULL
        AND available_in_movements IS FALSE
        AND available_in_budget IS FALSE
        AND available_in_reports IS FALSE
    )
) AS audit
FROM function_audit;
