-- =============================================================================
-- CLEANUP Quote dati di prova (NON Contabilita) — CORRETTO
-- payment_receipts usa fee_assignment_id (non payment_id)
-- =============================================================================

BEGIN;

DELETE FROM public.payment_receipts;

DELETE FROM public.payments;

DELETE FROM public.fee_assignments;

DELETE FROM public.fees
WHERE NOT EXISTS (
  SELECT 1 FROM public.fee_assignments fa WHERE fa.fee_id = fees.id
);

COMMIT;
