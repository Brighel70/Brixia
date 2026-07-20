-- =============================================================================
-- 021_sponsorship_contract_reopen.sql
-- Riapre un contratto confirmed → draft per correzioni (prima di fatture).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accounting_sponsorship_contract_reopen_draft(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_sponsorship_contracts%ROWTYPE;
  v_new public.accounting_sponsorship_contracts%ROWTYPE;
  v_linked int;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'accounting_sponsorship_contract_reopen_draft: p_id obbligatorio';
  END IF;

  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.post')
  ) THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_reopen_draft: permesso insufficiente'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_reopen_draft: auth.uid() richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_sponsorship_contracts
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_reopen_draft: contratto % non trovato', p_id;
  END IF;

  IF v_old.status IS DISTINCT FROM 'confirmed' THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_reopen_draft: status deve essere confirmed (attuale: %)',
      v_old.status;
  END IF;

  SELECT count(*)::int INTO v_linked
  FROM public.accounting_commercial_documents d
  WHERE d.sponsorship_contract_id = p_id
    AND d.status IN ('issued', 'partially_collected', 'collected');

  IF v_linked > 0 THEN
    RAISE EXCEPTION
      'accounting_sponsorship_contract_reopen_draft: contratto già usato in % documenti emessi',
      v_linked;
  END IF;

  PERFORM set_config('accounting.allow_commercial_mutation', '1', true);

  UPDATE public.accounting_sponsorship_contracts
  SET status = 'draft',
      confirmed_at = NULL,
      confirmed_by = NULL,
      pdf_path = NULL,
      updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_sponsorship_contracts',
    p_id,
    'sponsorship_contract_reopened',
    to_jsonb(v_old),
    to_jsonb(v_new),
    NULL,
    'ui',
    NULL,
    NULL
  );

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_sponsorship_contract_reopen_draft(uuid) IS
  'confirmed → draft per correzioni. Bloccato se già collegato a documenti emessi. Svuota pdf_path.';

GRANT EXECUTE ON FUNCTION public.accounting_sponsorship_contract_reopen_draft(uuid)
  TO authenticated;
