-- =============================================================================
-- 051 - Audit leggibile + approvazioni opzionali movimenti
--
-- VIEW su accounting_audit_log esistente (nessun log duplicato).
-- Workflow: simple (default) | verify_then_post
-- Colonne verified_at/verified_by gia' presenti su movements; aggiunge note.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Settings: mode approvazione
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_settings
  ADD COLUMN IF NOT EXISTS movement_approval_mode text NOT NULL DEFAULT 'simple'
    CHECK (movement_approval_mode IN ('simple', 'verify_then_post'));

COMMENT ON COLUMN public.accounting_settings.movement_approval_mode IS
  'simple = bozza→contabilizza; verify_then_post = bozza→verifica→contabilizza. Default simple per ASD piccole.';

-- -----------------------------------------------------------------------------
-- 2) Movimenti: nota di verifica (verified_at/by gia' in 012)
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_movements
  ADD COLUMN IF NOT EXISTS verification_note text NULL;

COMMENT ON COLUMN public.accounting_movements.verification_note IS
  'Nota della verifica pre-contabilizzazione (solo se movement_approval_mode = verify_then_post).';

-- Aggiorna profilo get per includere movement_approval_mode (colonna aggiunta sopra)
CREATE OR REPLACE FUNCTION public.accounting_fiscal_profile_get()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row public.accounting_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.view')
      OR public.has_accounting_permission('accounting.manage_settings')
    ) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;

  SELECT * INTO v_row FROM public.accounting_settings WHERE singleton_guard = true LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profilo fiscale non configurato';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'legal_form', v_row.legal_form,
    'tax_code', v_row.tax_code,
    'vat_number', v_row.vat_number,
    'rasd_registration', v_row.rasd_registration,
    'fiscal_regime', v_row.fiscal_regime,
    'regime_398_active', v_row.regime_398_active,
    'regime_398_from', v_row.regime_398_from,
    'regime_398_to', v_row.regime_398_to,
    'commercial_activity_active', v_row.commercial_activity_active,
    'ets_flag', v_row.ets_flag,
    'consultant_name', v_row.consultant_name,
    'consultant_notes', v_row.consultant_notes,
    'fiscal_profile_notes', v_row.fiscal_profile_notes,
    'params_verification_status', v_row.params_verification_status,
    'params_verified_at', v_row.params_verified_at,
    'future_modules', v_row.future_modules,
    'movement_approval_mode', COALESCE(v_row.movement_approval_mode, 'simple'),
    'disclaimer', 'Gestionale interno TeamFlow. Parametri da validare con il commercialista. Nessun invio SDI/F24/dichiarazioni.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) VIEW audit leggibile
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.accounting_audit_log_readable
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.entity_type,
  a.entity_id,
  a.action,
  a.old_value,
  a.new_value,
  a.actor_profile_id,
  COALESCE(
    NULLIF(btrim(p.full_name), ''),
    NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''),
    p.email,
    a.actor_profile_id::text
  ) AS actor_display_name,
  a.occurred_at,
  a.reason,
  a.origin,
  a.correlation_id,
  a.metadata,
  CASE a.action
    WHEN 'manual_movement_posted' THEN 'Movimento contabilizzato'
    WHEN 'manual_movement_cancelled' THEN 'Bozza annullata'
    WHEN 'manual_movement_reversed' THEN 'Movimento stornato'
    WHEN 'manual_reversal_created' THEN 'Creato movimento di storno'
    WHEN 'pending_account_assigned_and_posted' THEN 'Conto assegnato e contabilizzato'
    WHEN 'manual_transfer_created' THEN 'Giroconto creato'
    WHEN 'manual_transfer_updated' THEN 'Giroconto aggiornato'
    WHEN 'manual_movement_verified' THEN 'Movimento verificato'
    WHEN 'manual_movement_posted_with_override' THEN 'Contabilizzato con override'
    WHEN 'fiscal_year_opened' THEN 'Esercizio aperto'
    WHEN 'fiscal_year_closing_started' THEN 'Chiusura esercizio avviata'
    WHEN 'fiscal_year_closed' THEN 'Esercizio chiuso'
    WHEN 'fiscal_year_reopened' THEN 'Esercizio riaperto'
    WHEN 'reconciliation_session_created' THEN 'Sessione riconciliazione creata'
    WHEN 'reconciliation_session_completed' THEN 'Sessione riconciliazione completata'
    WHEN 'reconciliation_line_matched' THEN 'Riga estratto abbinata'
    WHEN 'reconciliation_line_excluded' THEN 'Riga estratto esclusa'
    WHEN 'fiscal_profile_updated' THEN 'Profilo fiscale aggiornato'
    WHEN 'deadline_created' THEN 'Scadenza creata'
    WHEN 'deadline_status_changed' THEN 'Stato scadenza aggiornato'
    WHEN 'approval_mode_changed' THEN 'Modalita approvazioni aggiornata'
    ELSE a.action
  END AS action_label
FROM public.accounting_audit_log a
LEFT JOIN public.profiles p ON p.id = a.actor_profile_id;

COMMENT ON VIEW public.accounting_audit_log_readable IS
  'Vista leggibile dell''audit Contabilità esistente. Nessun log duplicato. RLS via security_invoker sulla tabella base.';

REVOKE ALL ON public.accounting_audit_log_readable FROM PUBLIC, anon;
GRANT SELECT ON public.accounting_audit_log_readable TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) Helper: mode corrente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_movement_approval_mode()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(
    (SELECT movement_approval_mode FROM public.accounting_settings WHERE singleton_guard = true LIMIT 1),
    'simple'
  );
$$;

REVOKE ALL ON FUNCTION public.accounting_movement_approval_mode() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_movement_approval_mode() TO service_role;

-- -----------------------------------------------------------------------------
-- 5) RPC: configura mode
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_set_approval_mode(
  p_mode text,
  p_reason text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old text;
  v_mode text := btrim(p_mode);
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.manage_settings')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.manage_settings';
  END IF;
  IF v_mode NOT IN ('simple', 'verify_then_post') THEN
    RAISE EXCEPTION 'Mode non valido (simple | verify_then_post)';
  END IF;

  SELECT id, movement_approval_mode INTO v_id, v_old
  FROM public.accounting_settings
  WHERE singleton_guard = true
  FOR UPDATE;

  UPDATE public.accounting_settings
  SET movement_approval_mode = v_mode, updated_by = auth.uid()
  WHERE id = v_id;

  PERFORM public.accounting_audit_write(
    'accounting_settings', v_id, 'approval_mode_changed',
    jsonb_build_object('movement_approval_mode', v_old),
    jsonb_build_object('movement_approval_mode', v_mode),
    NULLIF(btrim(p_reason), ''),
    'ui'
  );

  RETURN v_mode;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6) RPC: verifica movimento
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_verify_manual_movement(
  p_movement_id uuid,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.verify';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Movimento non trovato'; END IF;
  IF v_movement.origin <> 'manual' THEN
    RAISE EXCEPTION 'Si possono verificare solo movimenti manuali';
  END IF;
  IF v_movement.status NOT IN ('draft', 'pending_account') THEN
    RAISE EXCEPTION 'Si possono verificare solo bozze';
  END IF;
  IF v_movement.verified_at IS NOT NULL THEN
    RETURN p_movement_id;
  END IF;

  UPDATE public.accounting_movements
  SET
    verified_at = now(),
    verified_by = auth.uid(),
    verification_note = NULLIF(btrim(p_note), ''),
    updated_by = auth.uid()
  WHERE id = p_movement_id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    p_movement_id,
    'manual_movement_verified',
    jsonb_build_object('verified_at', NULL),
    jsonb_build_object('verified_at', now(), 'verified_by', auth.uid()),
    NULLIF(btrim(p_note), ''),
    'ui'
  );

  RETURN p_movement_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7) Aggiorna post: gate verify_then_post + override
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_post_manual_movement(
  p_movement_id uuid,
  p_override_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
  v_entry_no integer;
  v_mode text;
  v_override boolean := false;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.post';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_movement.origin <> 'manual' THEN
    RAISE EXCEPTION 'Solo le bozze manuali possono essere contabilizzate da questa azione';
  END IF;
  IF v_movement.status NOT IN ('draft', 'pending_account') THEN
    RAISE EXCEPTION 'Il movimento non e'' una bozza contabilizzabile';
  END IF;
  IF v_movement.account_id IS NULL OR v_movement.category_id IS NULL
    OR v_movement.amount_cents <= 0 OR btrim(v_movement.description) = '' THEN
    RAISE EXCEPTION 'Completa conto, categoria, importo e descrizione prima di contabilizzare';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = v_movement.fiscal_year_id;

  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'La contabilizzazione e'' consentita solo in un esercizio aperto';
  END IF;
  IF v_movement.movement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on THEN
    RAISE EXCEPTION 'La data del movimento non appartiene all''esercizio selezionato';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_accounts
    WHERE id = v_movement.account_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Il conto selezionato non e'' attivo';
  END IF;

  IF v_movement.direction = 'transfer' THEN
    IF v_movement.transfer_account_id IS NULL
      OR v_movement.transfer_account_id = v_movement.account_id THEN
      RAISE EXCEPTION 'Per il giroconto seleziona un conto di destinazione diverso';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.accounting_accounts
      WHERE id = v_movement.transfer_account_id AND is_active IS TRUE
    ) THEN
      RAISE EXCEPTION 'Il conto di destinazione non e'' attivo';
    END IF;
  ELSIF v_movement.transfer_account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Il conto di destinazione e'' consentito solo per i giroconti';
  END IF;

  v_mode := public.accounting_movement_approval_mode();
  IF v_mode = 'verify_then_post' AND v_movement.verified_at IS NULL THEN
    IF (
      public.is_super_admin() OR public.is_app_admin()
    ) AND NULLIF(btrim(p_override_reason), '') IS NOT NULL THEN
      v_override := true;
    ELSE
      RAISE EXCEPTION
        'Workflow attivo: verifica il movimento prima di contabilizzare (oppure override Admin/Super Admin con motivazione)';
    END IF;
  END IF;

  v_entry_no := public.accounting_next_entry_no(v_movement.fiscal_year_id);

  UPDATE public.accounting_movements
  SET
    status = 'posted',
    entry_no = v_entry_no,
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_movement.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement.id,
    CASE WHEN v_override THEN 'manual_movement_posted_with_override' ELSE 'manual_movement_posted' END,
    jsonb_build_object('status', v_movement.status, 'entry_no', v_movement.entry_no),
    jsonb_build_object('status', 'posted', 'entry_no', v_entry_no),
    CASE WHEN v_override THEN btrim(p_override_reason) ELSE NULL END,
    'ui',
    NULL,
    jsonb_build_object(
      'movement_direction', v_movement.direction,
      'override', v_override,
      'approval_mode', v_mode
    )
  );

  RETURN v_movement.id;
END;
$$;

-- Compat: chiamata a 1 argomento resta valida (DEFAULT NULL su override)
-- Firma a 1 arg gia' sostituita dalla nuova con default.

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'accounting_set_approval_mode(text,text)',
    'accounting_verify_manual_movement(uuid,text)',
    'accounting_post_manual_movement(uuid,text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r);
  END LOOP;

  -- Mantieni anche la firma a 1 parametro se ancora presente come overload
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accounting_post_manual_movement'
      AND pg_get_function_identity_arguments(p.oid) = 'p_movement_id uuid'
  ) THEN
    -- Drop old 1-arg if 2-arg with default exists — PostgREST prefers exact matches.
    -- Keep single function with default instead.
    NULL;
  END IF;
END;
$$;

-- Drop old 1-parameter overload to avoid ambiguity (new fn has default)
DROP FUNCTION IF EXISTS public.accounting_post_manual_movement(uuid);

-- Ricrea esplicitamente solo la versione con default (gia' sopra) — se DROP ha rimosso, recreate:
CREATE OR REPLACE FUNCTION public.accounting_post_manual_movement(
  p_movement_id uuid,
  p_override_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_movement public.accounting_movements%ROWTYPE;
  v_fiscal_year public.accounting_fiscal_years%ROWTYPE;
  v_entry_no integer;
  v_mode text;
  v_override boolean := false;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.post')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.post';
  END IF;

  SELECT * INTO v_movement
  FROM public.accounting_movements
  WHERE id = p_movement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento non trovato';
  END IF;
  IF v_movement.origin <> 'manual' THEN
    RAISE EXCEPTION 'Solo le bozze manuali possono essere contabilizzate da questa azione';
  END IF;
  IF v_movement.status NOT IN ('draft', 'pending_account') THEN
    RAISE EXCEPTION 'Il movimento non e'' una bozza contabilizzabile';
  END IF;
  IF v_movement.account_id IS NULL OR v_movement.category_id IS NULL
    OR v_movement.amount_cents <= 0 OR btrim(v_movement.description) = '' THEN
    RAISE EXCEPTION 'Completa conto, categoria, importo e descrizione prima di contabilizzare';
  END IF;

  SELECT * INTO v_fiscal_year
  FROM public.accounting_fiscal_years
  WHERE id = v_movement.fiscal_year_id;

  IF NOT FOUND OR v_fiscal_year.status <> 'open' THEN
    RAISE EXCEPTION 'La contabilizzazione e'' consentita solo in un esercizio aperto';
  END IF;
  IF v_movement.movement_date NOT BETWEEN v_fiscal_year.starts_on AND v_fiscal_year.ends_on THEN
    RAISE EXCEPTION 'La data del movimento non appartiene all''esercizio selezionato';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.accounting_accounts
    WHERE id = v_movement.account_id AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Il conto selezionato non e'' attivo';
  END IF;

  IF v_movement.direction = 'transfer' THEN
    IF v_movement.transfer_account_id IS NULL
      OR v_movement.transfer_account_id = v_movement.account_id THEN
      RAISE EXCEPTION 'Per il giroconto seleziona un conto di destinazione diverso';
    END IF;
  ELSIF v_movement.transfer_account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Il conto di destinazione e'' consentito solo per i giroconti';
  END IF;

  v_mode := public.accounting_movement_approval_mode();
  IF v_mode = 'verify_then_post' AND v_movement.verified_at IS NULL THEN
    IF (public.is_super_admin() OR public.is_app_admin())
      AND NULLIF(btrim(p_override_reason), '') IS NOT NULL THEN
      v_override := true;
    ELSE
      RAISE EXCEPTION
        'Workflow attivo: verifica il movimento prima di contabilizzare (oppure override Admin/Super Admin con motivazione)';
    END IF;
  END IF;

  v_entry_no := public.accounting_next_entry_no(v_movement.fiscal_year_id);

  UPDATE public.accounting_movements
  SET
    status = 'posted',
    entry_no = v_entry_no,
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = v_movement.id;

  PERFORM public.accounting_audit_write(
    'accounting_movements',
    v_movement.id,
    CASE WHEN v_override THEN 'manual_movement_posted_with_override' ELSE 'manual_movement_posted' END,
    jsonb_build_object('status', v_movement.status, 'entry_no', v_movement.entry_no),
    jsonb_build_object('status', 'posted', 'entry_no', v_entry_no),
    CASE WHEN v_override THEN btrim(p_override_reason) ELSE NULL END,
    'ui',
    NULL,
    jsonb_build_object(
      'movement_direction', v_movement.direction,
      'override', v_override,
      'approval_mode', v_mode
    )
  );

  RETURN v_movement.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accounting_post_manual_movement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_post_manual_movement(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accounting_set_approval_mode(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_set_approval_mode(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accounting_verify_manual_movement(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounting_verify_manual_movement(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
