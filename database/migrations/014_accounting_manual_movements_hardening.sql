-- =============================================================================
-- 014_accounting_manual_movements_hardening.sql (PROPOSTA — NON APPLICARE SENZA APPROVAZIONE)
-- =============================================================================
-- Obiettivo opzionale: impedire UPDATE manuali su movimenti non manuali a livello DB.
-- Step 3B usa già guard UI + filtri .eq('origin','manual') nelle query di update.
--
-- Le policy 012 consentono già:
--   INSERT con accounting.create → status draft/pending_account
--   UPDATE con accounting.edit_draft → solo righe draft/pending_account
--
-- Gap residuo: un utente con edit_draft potrebbe teoricamente aggiornare una bozza
-- fee_sync pending_account via API diretta. Questa migration chiude il gap.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS accounting_movements_update ON public.accounting_movements;
CREATE POLICY accounting_movements_update ON public.accounting_movements
  FOR UPDATE TO authenticated
  USING (
    public.has_accounting_permission('accounting.edit_draft')
    AND status IN ('draft', 'pending_account')
    AND origin = 'manual'
  )
  WITH CHECK (
    public.has_accounting_permission('accounting.edit_draft')
    AND status IN ('draft', 'pending_account')
    AND origin = 'manual'
  );

COMMIT;
