-- =============================================================================
-- 010_accounting_foundation.sql
-- =============================================================================
-- STEP 2B — Fondazione Contabilità (solo configurazione) — REVISIONE
--
-- Crea:
--   - accounting_set_updated_at() (dedicata Contabilità; NON tocca update_updated_at_column)
--   - has_accounting_permission(requested_permission_key text)
--   - accounting_settings, accounting_fiscal_params, accounting_fiscal_years
--   - accounting_accounts, accounting_categories, accounting_payment_method_account_map
--   - seed permessi accounting.* (solo ruolo Admin)
--   - seed Cassa/Banca, mapping metodi, categorie minime, parametri fiscali unverified
--   - RLS sulle nuove tabelle
--
-- NON crea: receivables, movements, source_links, outbox, trigger Quote, Storage, UI.
-- NON modifica: fees, fee_assignments, payments, people, FlowMe, Auth.
-- NON crea/sostituisce: update_updated_at_column()
-- NON crea: accounting_schema_version
--
-- NON APPLICARE in produzione senza revisione e approvazione.
-- Parametri fiscali: PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Trigger updated_at dedicato Contabilità (NON ridefinire update_updated_at_column)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_set_updated_at() IS
  'Trigger BEFORE UPDATE: imposta NEW.updated_at. Solo tabelle accounting_*. '
  'Non sostituisce public.update_updated_at_column usata da Quote e altre aree.';

REVOKE ALL ON FUNCTION public.accounting_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_set_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_set_updated_at() TO service_role;

-- -----------------------------------------------------------------------------
-- 1) Helper permessi contabili
-- Schema confermato dall'export Supabase live (fonte autorevole):
--   permissions(id default, name UNIQUE NOT NULL, description, category NOT NULL,
--               position_order NOT NULL, created_at default)
--   role_permissions(role_id, permission_id, created_at default; PK composta)
--   user_permissions(id, user_id, permission_id, is_granted, created_at, updated_at)
--   user_roles(id, name, ...)
--   profiles(id, role, user_role_id, ...)
-- INSERT seed compatibile: permissions(name, description, category, position_order);
--   role_permissions(role_id, permission_id).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_accounting_permission(requested_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  uid uuid := auth.uid();
  role_uuid uuid;
  role_name text;
  has_explicit_deny boolean := false;
  has_explicit_grant boolean := false;
  has_via_role boolean := false;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  IF requested_permission_key IS NULL OR btrim(requested_permission_key) = '' THEN
    RETURN false;
  END IF;

  -- Bypass Admin (stesso criterio di is_app_admin: profiles.role)
  IF public.is_app_admin() THEN
    RETURN true;
  END IF;

  -- Override utente: un diniego esplicito prevale su qualsiasi grant
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions AS up
    INNER JOIN public.permissions AS p ON p.id = up.permission_id
    WHERE up.user_id = uid
      AND p.name = requested_permission_key
      AND up.is_granted IS FALSE
  )
  INTO has_explicit_deny;

  IF has_explicit_deny THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions AS up
    INNER JOIN public.permissions AS p ON p.id = up.permission_id
    WHERE up.user_id = uid
      AND p.name = requested_permission_key
      AND up.is_granted IS TRUE
  )
  INTO has_explicit_grant;

  IF has_explicit_grant THEN
    RETURN true;
  END IF;

  -- Ruolo: preferisci user_role_id, altrimenti match su profiles.role ~ user_roles.name
  SELECT pr.user_role_id, pr.role
  INTO role_uuid, role_name
  FROM public.profiles AS pr
  WHERE pr.id = uid;

  IF role_uuid IS NULL AND role_name IS NOT NULL THEN
    SELECT ur.id
    INTO role_uuid
    FROM public.user_roles AS ur
    WHERE ur.name ILIKE role_name
    LIMIT 1;
  END IF;

  IF role_uuid IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions AS rp
    INNER JOIN public.permissions AS p ON p.id = rp.permission_id
    WHERE rp.role_id = role_uuid
      AND p.name = requested_permission_key
  )
  INTO has_via_role;

  RETURN COALESCE(has_via_role, false);
END;
$$;

COMMENT ON FUNCTION public.has_accounting_permission(text) IS
  'True se auth.uid() ha il permesso contabile (deny user > grant user > ruolo, o is_app_admin). '
  'SECURITY DEFINER per evitare ricorsione RLS. Non usa is_society_staff.';

REVOKE ALL ON FUNCTION public.has_accounting_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_accounting_permission(text) FROM anon;
REVOKE ALL ON FUNCTION public.has_accounting_permission(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.has_accounting_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_accounting_permission(text) TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Seed permessi accounting.* (catalogo) — idempotente
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (name, description, category, position_order)
SELECT v.name, v.description, 'accounting', v.position_order
FROM (
  VALUES
    ('accounting.view', 'Visualizzare Contabilità', 900),
    ('accounting.create', 'Creare bozze contabili', 910),
    ('accounting.edit_draft', 'Modificare bozze contabili', 920),
    ('accounting.post', 'Contabilizzare / postare movimenti', 930),
    ('accounting.verify', 'Verificare stime e dati contabili', 940),
    ('accounting.close_period', 'Chiudere / riaprire esercizi e periodi', 950),
    ('accounting.manage_settings', 'Gestire impostazioni e parametri fiscali Contabilità', 960),
    ('accounting.export', 'Esportare dati Contabilità', 970),
    ('accounting.audit_view', 'Visualizzare audit Contabilità', 980)
) AS v(name, description, position_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions AS p WHERE p.name = v.name
);

-- Assegna tutti i permessi accounting.* SOLO al ruolo Admin (se esiste)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles AS ur
CROSS JOIN public.permissions AS p
WHERE ur.name ILIKE 'Admin'
  AND p.name LIKE 'accounting.%'
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions AS rp
    WHERE rp.role_id = ur.id
      AND rp.permission_id = p.id
  );

-- -----------------------------------------------------------------------------
-- 3) accounting_settings (singleton)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_guard boolean NOT NULL DEFAULT true,
  legal_form text NOT NULL DEFAULT 'ASD',
  tax_code text NULL,
  vat_number text NULL,
  rasd_registration text NULL,
  default_currency char(3) NOT NULL DEFAULT 'EUR',
  fiscal_regime text NOT NULL DEFAULT 'legge_398_1991',
  regime_398_active boolean NOT NULL DEFAULT true,
  regime_398_from date NULL,
  regime_398_to date NULL,
  consultant_name text NULL,
  consultant_notes text NULL,
  params_verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (params_verification_status IN ('unverified', 'verified')),
  params_verified_at timestamptz NULL,
  params_verified_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_settings_singleton UNIQUE (singleton_guard),
  CONSTRAINT accounting_settings_singleton_true CHECK (singleton_guard = true),
  CONSTRAINT accounting_settings_currency_eur CHECK (default_currency = 'EUR')
);

COMMENT ON TABLE public.accounting_settings IS
  'Configurazione Contabilità ASD (una sola riga). Parametri fiscali iniziali unverified.';
COMMENT ON COLUMN public.accounting_settings.params_verification_status IS
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. (finché unverified)';

DROP TRIGGER IF EXISTS trg_accounting_settings_updated_at ON public.accounting_settings;
CREATE TRIGGER trg_accounting_settings_updated_at
  BEFORE UPDATE ON public.accounting_settings
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

INSERT INTO public.accounting_settings (
  legal_form,
  default_currency,
  fiscal_regime,
  regime_398_active,
  params_verification_status,
  consultant_notes
)
SELECT
  'ASD',
  'EUR',
  'legge_398_1991',
  true,
  'unverified',
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.'
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_settings);

-- -----------------------------------------------------------------------------
-- 4) accounting_fiscal_params (versionati)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_params (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  param_key text NOT NULL,
  value_type text NOT NULL
    CHECK (value_type IN ('number', 'integer', 'text', 'boolean', 'json')),
  value_json jsonb NOT NULL,
  valid_from date NOT NULL,
  valid_to date NULL,
  source text NULL,
  source_url text NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified')),
  verification_note text NULL,
  verified_at timestamptz NULL,
  verified_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_fiscal_params_valid_range
    CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT accounting_fiscal_params_key_from_unique UNIQUE (param_key, valid_from)
);

COMMENT ON TABLE public.accounting_fiscal_params IS
  'Parametri fiscali versionati. Selezione futura per data di validità. '
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.';

DROP TRIGGER IF EXISTS trg_accounting_fiscal_params_updated_at ON public.accounting_fiscal_params;
CREATE TRIGGER trg_accounting_fiscal_params_updated_at
  BEFORE UPDATE ON public.accounting_fiscal_params
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- Seed parametri suggeriti (unverified) — nessuna IRES/IRAP
-- valid_from = inizio utilizzo configurazione TeamFlow (non data di entrata in vigore della norma)
INSERT INTO public.accounting_fiscal_params (
  param_key, value_type, value_json, valid_from, source, verification_status, verification_note
)
SELECT v.param_key, v.value_type, v.value_json::jsonb, DATE '2026-01-01', v.source, 'unverified',
       'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.'
FROM (
  VALUES
    ('commercial_revenue_limit', 'integer', '40000000',
     'Valore iniziale configurativo TeamFlow dal 2026 — da verificare con il commercialista; non rappresenta la data di entrata in vigore della norma.'),
    ('vat_flat_deduction_pct', 'number', '50',
     'Valore iniziale configurativo TeamFlow dal 2026 — da verificare con il commercialista; non rappresenta la data di entrata in vigore della norma.'),
    ('vat_periodicity', 'text', '"quarterly"',
     'Valore iniziale configurativo TeamFlow dal 2026 — da verificare con il commercialista; non rappresenta la data di entrata in vigore della norma.'),
    ('vat_rate_sponsorship', 'number', '22',
     'Valore iniziale configurativo TeamFlow dal 2026 — da verificare con il commercialista; non rappresenta la data di entrata in vigore della norma.'),
    ('vat_rounding_method', 'text', '"half_up_cent"',
     'Valore iniziale configurativo TeamFlow dal 2026 — da verificare con il commercialista; non rappresenta la data di entrata in vigore della norma.')
) AS v(param_key, value_type, value_json, source)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.accounting_fiscal_params AS p
  WHERE p.param_key = v.param_key
    AND p.valid_from = DATE '2026-01-01'
);

-- -----------------------------------------------------------------------------
-- 5) accounting_fiscal_years
-- Transizioni definitive draft/open/closing/closed saranno protette da RPC + audit
-- nello step dedicato. Qui: manage_settings solo su draft; close_period/Admin sulle
-- altre operazioni di UPDATE; INSERT manage_settings solo con status draft.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'closing', 'closed')),
  currency char(3) NOT NULL DEFAULT 'EUR',
  opening_notes text NULL,
  opened_at timestamptz NULL,
  opened_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  closing_started_at timestamptz NULL,
  closing_started_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at timestamptz NULL,
  closed_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopened_at timestamptz NULL,
  reopened_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopen_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_fiscal_years_code_unique UNIQUE (code),
  CONSTRAINT accounting_fiscal_years_range CHECK (ends_on >= starts_on),
  CONSTRAINT accounting_fiscal_years_currency_eur CHECK (currency = 'EUR'),
  CONSTRAINT accounting_fiscal_years_period_unique UNIQUE (starts_on, ends_on)
);

COMMENT ON TABLE public.accounting_fiscal_years IS
  'Esercizi contabili. Nessun esercizio creato automaticamente in questa migration. '
  'UI futura proporrà default 1 gennaio–31 dicembre. '
  'Transizioni status definitive: RPC/audit in step successivo.';

CREATE INDEX IF NOT EXISTS idx_accounting_fiscal_years_status
  ON public.accounting_fiscal_years (status);

DROP TRIGGER IF EXISTS trg_accounting_fiscal_years_updated_at ON public.accounting_fiscal_years;
CREATE TRIGGER trg_accounting_fiscal_years_updated_at
  BEFORE UPDATE ON public.accounting_fiscal_years
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 6) accounting_accounts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash', 'bank', 'other')),
  iban text NULL,
  currency char(3) NOT NULL DEFAULT 'EUR',
  is_active boolean NOT NULL DEFAULT true,
  opening_balance_cents bigint NOT NULL DEFAULT 0,
  opening_balance_date date NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz NULL,
  archived_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_accounts_code_unique UNIQUE (code),
  CONSTRAINT accounting_accounts_currency_eur CHECK (currency = 'EUR')
);

COMMENT ON TABLE public.accounting_accounts IS
  'Conti finanziari (cassa/banca/altro). Saldo corrente non denormalizzato: si calcola dai movimenti.';

CREATE INDEX IF NOT EXISTS idx_accounting_accounts_kind_active
  ON public.accounting_accounts (kind, is_active);

DROP TRIGGER IF EXISTS trg_accounting_accounts_updated_at ON public.accounting_accounts;
CREATE TRIGGER trg_accounting_accounts_updated_at
  BEFORE UPDATE ON public.accounting_accounts
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

INSERT INTO public.accounting_accounts (code, name, kind, currency, is_active, opening_balance_cents)
SELECT 'CASSA', 'Cassa', 'cash', 'EUR', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts WHERE code = 'CASSA');

INSERT INTO public.accounting_accounts (code, name, kind, currency, is_active, opening_balance_cents)
SELECT 'BANCA', 'Banca', 'bank', 'EUR', true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_accounts WHERE code = 'BANCA');

-- -----------------------------------------------------------------------------
-- 7) accounting_categories (economiche — NON confondere con public.categories)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NULL REFERENCES public.accounting_categories(id),
  code text NOT NULL,
  name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('income', 'expense', 'both')),
  default_nature text NOT NULL
    CHECK (default_nature IN ('institutional', 'commercial', 'mixed', 'to_classify')),
  include_in_commercial_limit boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz NULL,
  archived_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_categories_code_unique UNIQUE (code),
  CONSTRAINT accounting_categories_parent_ne_self CHECK (parent_id IS NULL OR parent_id <> id)
);

COMMENT ON TABLE public.accounting_categories IS
  'Categorie economiche Contabilità (distinte da public.categories / squadre TeamFlow).';

CREATE INDEX IF NOT EXISTS idx_accounting_categories_parent
  ON public.accounting_categories (parent_id);

DROP TRIGGER IF EXISTS trg_accounting_categories_updated_at ON public.accounting_categories;
CREATE TRIGGER trg_accounting_categories_updated_at
  BEFORE UPDATE ON public.accounting_categories
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit, is_system, sort_order, notes
)
SELECT
  'QUOTE',
  'Quote associative/sportive',
  'income',
  'institutional',
  false,
  true,
  10,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. '
  'Natura istituzionale e esclusione dal limite commerciale sono ipotesi iniziali.'
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_categories WHERE code = 'QUOTE');

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit, is_system, sort_order, notes
)
SELECT
  'ALTRE_ENTRATE',
  'Altre entrate da classificare',
  'income',
  'to_classify',
  false,
  true,
  20,
  'Categoria di sistema: da classificare.'
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_categories WHERE code = 'ALTRE_ENTRATE');

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit, is_system, sort_order, notes
)
SELECT
  'ALTRE_USCITE',
  'Altre uscite da classificare',
  'expense',
  'to_classify',
  false,
  true,
  30,
  'Categoria di sistema: da classificare.'
WHERE NOT EXISTS (SELECT 1 FROM public.accounting_categories WHERE code = 'ALTRE_USCITE');

-- -----------------------------------------------------------------------------
-- 8) accounting_payment_method_account_map
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_payment_method_account_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  raw_payment_method text NOT NULL,
  normalized_method text NULL,
  account_id uuid NOT NULL REFERENCES public.accounting_accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_payment_method_map_unique
    UNIQUE (source_system, raw_payment_method)
);

COMMENT ON TABLE public.accounting_payment_method_account_map IS
  'Mappa metodi pagamento Quote (fees) → conti Contabilità. Metodi non mappati → pending_account.';

DROP TRIGGER IF EXISTS trg_accounting_payment_method_map_updated_at
  ON public.accounting_payment_method_account_map;
CREATE TRIGGER trg_accounting_payment_method_map_updated_at
  BEFORE UPDATE ON public.accounting_payment_method_account_map
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

INSERT INTO public.accounting_payment_method_account_map (
  source_system, raw_payment_method, normalized_method, account_id, is_active
)
SELECT 'fees', 'cash', 'cash', a.id, true
FROM public.accounting_accounts AS a
WHERE a.code = 'CASSA'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_payment_method_account_map AS m
    WHERE m.source_system = 'fees' AND m.raw_payment_method = 'cash'
  );

INSERT INTO public.accounting_payment_method_account_map (
  source_system, raw_payment_method, normalized_method, account_id, is_active
)
SELECT 'fees', 'contanti', 'cash', a.id, true
FROM public.accounting_accounts AS a
WHERE a.code = 'CASSA'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_payment_method_account_map AS m
    WHERE m.source_system = 'fees' AND m.raw_payment_method = 'contanti'
  );

INSERT INTO public.accounting_payment_method_account_map (
  source_system, raw_payment_method, normalized_method, account_id, is_active
)
SELECT 'fees', 'bank_transfer', 'bank_transfer', a.id, true
FROM public.accounting_accounts AS a
WHERE a.code = 'BANCA'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_payment_method_account_map AS m
    WHERE m.source_system = 'fees' AND m.raw_payment_method = 'bank_transfer'
  );

INSERT INTO public.accounting_payment_method_account_map (
  source_system, raw_payment_method, normalized_method, account_id, is_active
)
SELECT 'fees', 'bonifico', 'bank_transfer', a.id, true
FROM public.accounting_accounts AS a
WHERE a.code = 'BANCA'
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_payment_method_account_map AS m
    WHERE m.source_system = 'fees' AND m.raw_payment_method = 'bonifico'
  );

-- -----------------------------------------------------------------------------
-- 9) GRANT (authenticated) — minimo privilegio; nessun DELETE/TRUNCATE/etc.
-- -----------------------------------------------------------------------------
REVOKE ALL ON public.accounting_settings FROM anon;
REVOKE ALL ON public.accounting_fiscal_params FROM anon;
REVOKE ALL ON public.accounting_fiscal_years FROM anon;
REVOKE ALL ON public.accounting_accounts FROM anon;
REVOKE ALL ON public.accounting_categories FROM anon;
REVOKE ALL ON public.accounting_payment_method_account_map FROM anon;

REVOKE ALL ON public.accounting_settings FROM PUBLIC;
REVOKE ALL ON public.accounting_fiscal_params FROM PUBLIC;
REVOKE ALL ON public.accounting_fiscal_years FROM PUBLIC;
REVOKE ALL ON public.accounting_accounts FROM PUBLIC;
REVOKE ALL ON public.accounting_categories FROM PUBLIC;
REVOKE ALL ON public.accounting_payment_method_account_map FROM PUBLIC;

REVOKE ALL ON public.accounting_settings FROM authenticated;
REVOKE ALL ON public.accounting_fiscal_params FROM authenticated;
REVOKE ALL ON public.accounting_fiscal_years FROM authenticated;
REVOKE ALL ON public.accounting_accounts FROM authenticated;
REVOKE ALL ON public.accounting_categories FROM authenticated;
REVOKE ALL ON public.accounting_payment_method_account_map FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.accounting_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_fiscal_params TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_fiscal_years TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounting_payment_method_account_map TO authenticated;

GRANT ALL ON public.accounting_settings TO service_role;
GRANT ALL ON public.accounting_fiscal_params TO service_role;
GRANT ALL ON public.accounting_fiscal_years TO service_role;
GRANT ALL ON public.accounting_accounts TO service_role;
GRANT ALL ON public.accounting_categories TO service_role;
GRANT ALL ON public.accounting_payment_method_account_map TO service_role;

-- Nessun GRANT a anon / public
-- Nessun GRANT DELETE/TRUNCATE/REFERENCES/TRIGGER a authenticated

-- -----------------------------------------------------------------------------
-- 10) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_fiscal_params ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_payment_method_account_map ENABLE ROW LEVEL SECURITY;

-- accounting_settings
DROP POLICY IF EXISTS accounting_settings_select ON public.accounting_settings;
CREATE POLICY accounting_settings_select ON public.accounting_settings
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_settings_insert ON public.accounting_settings;
CREATE POLICY accounting_settings_insert ON public.accounting_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

DROP POLICY IF EXISTS accounting_settings_update ON public.accounting_settings;
CREATE POLICY accounting_settings_update ON public.accounting_settings
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- accounting_fiscal_params
DROP POLICY IF EXISTS accounting_fiscal_params_select ON public.accounting_fiscal_params;
CREATE POLICY accounting_fiscal_params_select ON public.accounting_fiscal_params
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_fiscal_params_insert ON public.accounting_fiscal_params;
CREATE POLICY accounting_fiscal_params_insert ON public.accounting_fiscal_params
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

DROP POLICY IF EXISTS accounting_fiscal_params_update ON public.accounting_fiscal_params;
CREATE POLICY accounting_fiscal_params_update ON public.accounting_fiscal_params
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- accounting_fiscal_years
-- SELECT: view o Admin
DROP POLICY IF EXISTS accounting_fiscal_years_select ON public.accounting_fiscal_years;
CREATE POLICY accounting_fiscal_years_select ON public.accounting_fiscal_years
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- INSERT: manage_settings solo con status draft; Admin bypass
DROP POLICY IF EXISTS accounting_fiscal_years_insert ON public.accounting_fiscal_years;
DROP POLICY IF EXISTS accounting_fiscal_years_insert_manage_settings ON public.accounting_fiscal_years;
DROP POLICY IF EXISTS accounting_fiscal_years_insert_admin ON public.accounting_fiscal_years;

CREATE POLICY accounting_fiscal_years_insert_manage_settings ON public.accounting_fiscal_years
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_accounting_permission('accounting.manage_settings')
    AND status = 'draft'
  );

CREATE POLICY accounting_fiscal_years_insert_admin ON public.accounting_fiscal_years
  FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

-- UPDATE manage_settings: solo se riga corrente è draft e resta draft
DROP POLICY IF EXISTS accounting_fiscal_years_update ON public.accounting_fiscal_years;
DROP POLICY IF EXISTS accounting_fiscal_years_update_manage_settings ON public.accounting_fiscal_years;
DROP POLICY IF EXISTS accounting_fiscal_years_update_close_period ON public.accounting_fiscal_years;
DROP POLICY IF EXISTS accounting_fiscal_years_update_admin ON public.accounting_fiscal_years;

CREATE POLICY accounting_fiscal_years_update_manage_settings ON public.accounting_fiscal_years
  FOR UPDATE TO authenticated
  USING (
    public.has_accounting_permission('accounting.manage_settings')
    AND status = 'draft'
  )
  WITH CHECK (
    public.has_accounting_permission('accounting.manage_settings')
    AND status = 'draft'
  );

-- UPDATE close_period: transizioni operative (senza RPC/audit in questo step)
CREATE POLICY accounting_fiscal_years_update_close_period ON public.accounting_fiscal_years
  FOR UPDATE TO authenticated
  USING (public.has_accounting_permission('accounting.close_period'))
  WITH CHECK (public.has_accounting_permission('accounting.close_period'));

-- UPDATE Admin bypass
CREATE POLICY accounting_fiscal_years_update_admin ON public.accounting_fiscal_years
  FOR UPDATE TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- accounting_accounts
DROP POLICY IF EXISTS accounting_accounts_select ON public.accounting_accounts;
CREATE POLICY accounting_accounts_select ON public.accounting_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_accounts_insert ON public.accounting_accounts;
CREATE POLICY accounting_accounts_insert ON public.accounting_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

DROP POLICY IF EXISTS accounting_accounts_update ON public.accounting_accounts;
CREATE POLICY accounting_accounts_update ON public.accounting_accounts
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- accounting_categories
DROP POLICY IF EXISTS accounting_categories_select ON public.accounting_categories;
CREATE POLICY accounting_categories_select ON public.accounting_categories
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_categories_insert ON public.accounting_categories;
CREATE POLICY accounting_categories_insert ON public.accounting_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

DROP POLICY IF EXISTS accounting_categories_update ON public.accounting_categories;
CREATE POLICY accounting_categories_update ON public.accounting_categories
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- accounting_payment_method_account_map
DROP POLICY IF EXISTS accounting_payment_method_map_select
  ON public.accounting_payment_method_account_map;
CREATE POLICY accounting_payment_method_map_select
  ON public.accounting_payment_method_account_map
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_payment_method_map_insert
  ON public.accounting_payment_method_account_map;
CREATE POLICY accounting_payment_method_map_insert
  ON public.accounting_payment_method_account_map
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

DROP POLICY IF EXISTS accounting_payment_method_map_update
  ON public.accounting_payment_method_account_map;
CREATE POLICY accounting_payment_method_map_update
  ON public.accounting_payment_method_account_map
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- Nessuna policy DELETE → DELETE negato a authenticated (anche Admin JWT).
-- Nessuna policy per anon.

COMMIT;
