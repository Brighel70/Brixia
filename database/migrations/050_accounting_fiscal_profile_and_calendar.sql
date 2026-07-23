-- =============================================================================
-- 050 - Profilo fiscale ASD + calendario scadenze operative
--
-- Estende accounting_settings; scadenze gestionali (NON invii SDI/F24).
-- Parametri restano "da validare" con il commercialista.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Estensione profilo fiscale (singleton settings)
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_settings
  ADD COLUMN IF NOT EXISTS commercial_activity_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ets_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fiscal_profile_notes text NULL,
  ADD COLUMN IF NOT EXISTS future_modules jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.accounting_settings.commercial_activity_active IS
  'Attivita commerciale dichiarata (gestionale). Da validare con il commercialista.';
COMMENT ON COLUMN public.accounting_settings.ets_flag IS
  'Ente del Terzo Settore (flag gestionale). Impatta regimi agevolati — da validare.';
COMMENT ON COLUMN public.accounting_settings.fiscal_profile_notes IS
  'Note libere sul profilo fiscale. Non sostituiscono consulenza professionale.';
COMMENT ON COLUMN public.accounting_settings.future_modules IS
  'Estendibilita futura (rimborsi/collaboratori/F24): moduli spenti, nessuna UI incompleta. Esempio: {"reimbursements":false,"sport_workers":false,"f24":false}';

UPDATE public.accounting_settings
SET
  future_modules = COALESCE(future_modules, '{}'::jsonb) || jsonb_build_object(
    'reimbursements', false,
    'sport_workers', false,
    'f24', false,
    'payroll', false
  ),
  fiscal_profile_notes = COALESCE(
    fiscal_profile_notes,
    'PARAMETRI GESTIONALI — da validare con il commercialista. TeamFlow non invia SDI, F24 o dichiarazioni.'
  ),
  consultant_notes = CASE
    WHEN consultant_notes IS NULL OR btrim(consultant_notes) = ''
      THEN 'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.'
    ELSE consultant_notes
  END
WHERE singleton_guard = true;

-- legal_form: assicurare valori tipici ASD/SSD (senza rompere valori custom gia' presenti)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'accounting_settings_legal_form_known'
      AND conrelid = 'public.accounting_settings'::regclass
  ) THEN
    -- Soft check: non forzare se gia' ci sono valori fuori set; solo commento
    NULL;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2) Snapshot storico profilo (opzionale, append-only via RPC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_profile_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL,
  reason text NULL
);

COMMENT ON TABLE public.accounting_fiscal_profile_snapshots IS
  'Storico del profilo fiscale settings. Gestionale interno, non dichiarazione.';

ALTER TABLE public.accounting_fiscal_profile_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_fiscal_profile_snapshots_select
  ON public.accounting_fiscal_profile_snapshots;
CREATE POLICY accounting_fiscal_profile_snapshots_select
  ON public.accounting_fiscal_profile_snapshots
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
    OR public.has_accounting_permission('accounting.manage_settings')
  );

REVOKE ALL ON TABLE public.accounting_fiscal_profile_snapshots FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.accounting_fiscal_profile_snapshots TO authenticated, service_role;
GRANT ALL ON TABLE public.accounting_fiscal_profile_snapshots TO service_role;

-- -----------------------------------------------------------------------------
-- 3) Calendario scadenze operative
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_operational_deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE SET NULL,
  deadline_type text NOT NULL
    CHECK (deadline_type IN (
      'vat_reminder',
      'f24_reminder',
      'rasd',
      'rendiconto',
      'document',
      'internal_review',
      'renewal',
      'other'
    )),
  title text NOT NULL,
  due_on date NOT NULL,
  remind_on date NULL,
  assignee_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'done', 'cancelled', 'snoozed')),
  notes text NULL,
  is_fiscal_filing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_operational_deadlines_title_nonempty
    CHECK (btrim(title) <> ''),
  CONSTRAINT accounting_operational_deadlines_no_auto_filing
    CHECK (is_fiscal_filing = false)
);

COMMENT ON TABLE public.accounting_operational_deadlines IS
  'Scadenze operative/promemoria gestionali. NON simulano invii fiscali automatici (SDI/F24/dichiarazioni).';
COMMENT ON COLUMN public.accounting_operational_deadlines.is_fiscal_filing IS
  'Sempre false in v1: TeamFlow non effettua adempimenti telematici.';
COMMENT ON COLUMN public.accounting_operational_deadlines.deadline_type IS
  'f24_reminder / vat_reminder = soli promemoria interni, non generano F24 ne liquidazioni telematiche.';

CREATE INDEX IF NOT EXISTS idx_accounting_deadlines_due
  ON public.accounting_operational_deadlines (due_on);
CREATE INDEX IF NOT EXISTS idx_accounting_deadlines_status
  ON public.accounting_operational_deadlines (status);
CREATE INDEX IF NOT EXISTS idx_accounting_deadlines_fy
  ON public.accounting_operational_deadlines (fiscal_year_id);

DROP TRIGGER IF EXISTS trg_accounting_deadlines_updated_at
  ON public.accounting_operational_deadlines;
CREATE TRIGGER trg_accounting_deadlines_updated_at
  BEFORE UPDATE ON public.accounting_operational_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

ALTER TABLE public.accounting_operational_deadlines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accounting_deadlines_select ON public.accounting_operational_deadlines;
CREATE POLICY accounting_deadlines_select ON public.accounting_operational_deadlines
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

REVOKE ALL ON TABLE public.accounting_operational_deadlines FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.accounting_operational_deadlines TO authenticated, service_role;
GRANT ALL ON TABLE public.accounting_operational_deadlines TO service_role;

-- -----------------------------------------------------------------------------
-- 4) RPC profilo
-- -----------------------------------------------------------------------------
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
    'disclaimer', 'Gestionale interno TeamFlow. Parametri da validare con il commercialista. Nessun invio SDI/F24/dichiarazioni.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_fiscal_profile_update(
  p_payload jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old public.accounting_settings%ROWTYPE;
  v_new public.accounting_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.manage_settings')
    ) THEN
    RAISE EXCEPTION 'Permesso negato: serve accounting.manage_settings';
  END IF;

  SELECT * INTO v_old FROM public.accounting_settings WHERE singleton_guard = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profilo fiscale non configurato';
  END IF;

  INSERT INTO public.accounting_fiscal_profile_snapshots (snapshot_by, payload, reason)
  VALUES (auth.uid(), to_jsonb(v_old), COALESCE(NULLIF(btrim(p_reason), ''), 'pre_update'));

  UPDATE public.accounting_settings
  SET
    legal_form = COALESCE(NULLIF(btrim(p_payload->>'legal_form'), ''), legal_form),
    tax_code = CASE WHEN p_payload ? 'tax_code' THEN NULLIF(btrim(p_payload->>'tax_code'), '') ELSE tax_code END,
    vat_number = CASE WHEN p_payload ? 'vat_number' THEN NULLIF(btrim(p_payload->>'vat_number'), '') ELSE vat_number END,
    rasd_registration = CASE WHEN p_payload ? 'rasd_registration' THEN NULLIF(btrim(p_payload->>'rasd_registration'), '') ELSE rasd_registration END,
    fiscal_regime = COALESCE(NULLIF(btrim(p_payload->>'fiscal_regime'), ''), fiscal_regime),
    regime_398_active = COALESCE((p_payload->>'regime_398_active')::boolean, regime_398_active),
    regime_398_from = CASE WHEN p_payload ? 'regime_398_from' THEN NULLIF(p_payload->>'regime_398_from', '')::date ELSE regime_398_from END,
    regime_398_to = CASE WHEN p_payload ? 'regime_398_to' THEN NULLIF(p_payload->>'regime_398_to', '')::date ELSE regime_398_to END,
    commercial_activity_active = COALESCE((p_payload->>'commercial_activity_active')::boolean, commercial_activity_active),
    ets_flag = COALESCE((p_payload->>'ets_flag')::boolean, ets_flag),
    consultant_name = CASE WHEN p_payload ? 'consultant_name' THEN NULLIF(btrim(p_payload->>'consultant_name'), '') ELSE consultant_name END,
    consultant_notes = CASE WHEN p_payload ? 'consultant_notes' THEN NULLIF(btrim(p_payload->>'consultant_notes'), '') ELSE consultant_notes END,
    fiscal_profile_notes = CASE WHEN p_payload ? 'fiscal_profile_notes' THEN NULLIF(btrim(p_payload->>'fiscal_profile_notes'), '') ELSE fiscal_profile_notes END,
    -- Ogni modifica riporta a unverified se non esplicitamente verificata in RPC dedicata
    params_verification_status = CASE
      WHEN COALESCE((p_payload->>'mark_verified')::boolean, false) THEN 'verified'
      ELSE 'unverified'
    END,
    params_verified_at = CASE
      WHEN COALESCE((p_payload->>'mark_verified')::boolean, false) THEN now()
      ELSE NULL
    END,
    params_verified_by = CASE
      WHEN COALESCE((p_payload->>'mark_verified')::boolean, false) THEN auth.uid()
      ELSE NULL
    END,
    updated_by = auth.uid()
  WHERE id = v_old.id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_settings',
    v_old.id,
    'fiscal_profile_updated',
    jsonb_build_object(
      'legal_form', v_old.legal_form,
      'regime_398_active', v_old.regime_398_active,
      'params_verification_status', v_old.params_verification_status
    ),
    jsonb_build_object(
      'legal_form', v_new.legal_form,
      'regime_398_active', v_new.regime_398_active,
      'params_verification_status', v_new.params_verification_status
    ),
    NULLIF(btrim(p_reason), ''),
    'ui'
  );

  RETURN public.accounting_fiscal_profile_get();
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) RPC scadenze
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_deadline_create(
  p_title text,
  p_due_on date,
  p_deadline_type text DEFAULT 'other',
  p_fiscal_year_id uuid DEFAULT NULL,
  p_assignee_profile_id uuid DEFAULT NULL,
  p_remind_on date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_type text := COALESCE(NULLIF(btrim(p_deadline_type), ''), 'other');
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.manage_settings')
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL OR p_due_on IS NULL THEN
    RAISE EXCEPTION 'Titolo e data obbligatorî';
  END IF;
  IF v_type NOT IN (
    'vat_reminder', 'f24_reminder', 'rasd', 'rendiconto',
    'document', 'internal_review', 'renewal', 'other'
  ) THEN
    RAISE EXCEPTION 'Tipo scadenza non valido';
  END IF;

  INSERT INTO public.accounting_operational_deadlines (
    fiscal_year_id, deadline_type, title, due_on, remind_on,
    assignee_profile_id, status, notes, is_fiscal_filing,
    created_by, updated_by
  ) VALUES (
    p_fiscal_year_id, v_type, btrim(p_title), p_due_on, p_remind_on,
    p_assignee_profile_id, 'open', NULLIF(btrim(p_notes), ''), false,
    auth.uid(), auth.uid()
  )
  RETURNING id INTO v_id;

  PERFORM public.accounting_audit_write(
    'accounting_operational_deadlines', v_id, 'deadline_created',
    NULL,
    jsonb_build_object('title', btrim(p_title), 'due_on', p_due_on, 'type', v_type),
    NULL, 'ui'
  );

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_deadline_set_status(
  p_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old public.accounting_operational_deadlines%ROWTYPE;
  v_status text := btrim(p_status);
BEGIN
  IF auth.uid() IS NULL
    OR NOT (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.manage_settings')
      OR public.has_accounting_permission('accounting.verify')
    ) THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;
  IF v_status NOT IN ('open', 'done', 'cancelled', 'snoozed') THEN
    RAISE EXCEPTION 'Stato non valido';
  END IF;

  SELECT * INTO v_old FROM public.accounting_operational_deadlines WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scadenza non trovata'; END IF;

  UPDATE public.accounting_operational_deadlines
  SET
    status = v_status,
    notes = COALESCE(NULLIF(btrim(p_notes), ''), notes),
    completed_at = CASE WHEN v_status = 'done' THEN now() ELSE completed_at END,
    completed_by = CASE WHEN v_status = 'done' THEN auth.uid() ELSE completed_by END,
    updated_by = auth.uid()
  WHERE id = p_id;

  PERFORM public.accounting_audit_write(
    'accounting_operational_deadlines', p_id, 'deadline_status_changed',
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', v_status),
    NULLIF(btrim(p_notes), ''),
    'ui'
  );

  RETURN p_id;
END;
$$;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY[
    'accounting_fiscal_profile_get()',
    'accounting_fiscal_profile_update(jsonb,text)',
    'accounting_deadline_create(text,date,text,uuid,uuid,date,text)',
    'accounting_deadline_set_status(uuid,text,text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', r);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', r);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
