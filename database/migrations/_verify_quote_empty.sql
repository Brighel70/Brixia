-- =============================================================================
-- VERIFY Quote vuote — READ-ONLY (dopo cleanup)
-- =============================================================================
SELECT
  jsonb_build_object(
    'read_only', true,
    'modifies_data', false,
    'payments_count', (SELECT COUNT(*)::int FROM public.payments),
    'fee_assignments_count', (SELECT COUNT(*)::int FROM public.fee_assignments),
    'fees_count', (SELECT COUNT(*)::int FROM public.fees),
    'payment_receipts_count', (SELECT COUNT(*)::int FROM public.payment_receipts),
    'accounting_core_still_empty', jsonb_build_object(
      'counterparties', (SELECT COUNT(*)::int FROM public.accounting_counterparties),
      'receivables', (SELECT COUNT(*)::int FROM public.accounting_receivables),
      'movements', (SELECT COUNT(*)::int FROM public.accounting_movements),
      'source_links', (SELECT COUNT(*)::int FROM public.accounting_source_links),
      'audit_log', (SELECT COUNT(*)::int FROM public.accounting_audit_log)
    ),
    'quote_ready_for_2e', (
      (SELECT COUNT(*) FROM public.payments) = 0
      AND (SELECT COUNT(*) FROM public.fee_assignments) = 0
    )
  ) AS quote_cleanup_verify;
