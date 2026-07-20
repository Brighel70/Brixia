-- =============================================================================
-- 012_accounting_core.sql
-- =============================================================================
-- STEP 2C — Nucleo contabile (senza sincronizzazione Quote) — REVISIONE
--
-- Crea:
--   - accounting_counterparties
--   - accounting_receivables (residual GENERATED STORED)
--   - accounting_movements (immutabilità via GRANT/policy; posting/storno via RPC future)
--   - accounting_movement_allocations (DELETE solo su bozze)
--   - accounting_source_links (mappa stabile source→contabile, non log eventi)
--   - accounting_audit_log (append-only intenzionale)
--
-- NON crea: outbox, trigger Quote, seed, UI, backfill, esercizi, IVA,
--           RPC posting/storno, protezioni trigger su movements.
-- NON modifica: fees, fee_assignments, payments, payment_receipts, people, FlowMe.
--
-- Prerequisiti: 010 + 011 applicate.
-- NON APPLICARE senza revisione e approvazione.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0) Protezioni soft-delete / audit (NON su movements; NON su allocations)
-- -----------------------------------------------------------------------------
-- accounting_forbid_physical_delete: intenzionalmente blocca DELETE anche per
-- service_role su counterparties e receivables. Archiviazione = archived_at.
-- Procedure future NON devono tentare DELETE su queste tabelle.
CREATE OR REPLACE FUNCTION public.accounting_forbid_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION
    '%: cancellazione fisica non consentita (usare archiviazione via archived_at)',
    TG_TABLE_NAME
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.accounting_forbid_physical_delete() IS
  'BEFORE DELETE su counterparties/receivables: vieta DELETE fisico anche per service_role. '
  'Usare archived_at. Non applicata a movements né allocations.';

REVOKE ALL ON FUNCTION public.accounting_forbid_physical_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_forbid_physical_delete() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_forbid_physical_delete() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_forbid_physical_delete() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_forbid_physical_delete() TO service_role;

-- accounting_protect_audit_append_only: intenzionale — blocca UPDATE/DELETE
-- anche per service_role. INSERT consentito a service_role (GRANT ALL),
-- nessun GRANT INSERT/UPDATE/DELETE ad authenticated, nessuna policy di scrittura.
CREATE OR REPLACE FUNCTION public.accounting_protect_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION
    'accounting_audit_log: tabella append-only (UPDATE/DELETE non consentiti, anche a service_role)'
    USING ERRCODE = 'check_violation';
END;
$$;

COMMENT ON FUNCTION public.accounting_protect_audit_append_only() IS
  'BEFORE UPDATE/DELETE su accounting_audit_log: append-only intenzionale anche per service_role. '
  'INSERT via service_role / future funzioni controllate.';

REVOKE ALL ON FUNCTION public.accounting_protect_audit_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_protect_audit_append_only() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_protect_audit_append_only() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_protect_audit_append_only() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_protect_audit_append_only() TO service_role;

-- -----------------------------------------------------------------------------
-- 1) accounting_counterparties
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CHECK (kind IN (
      'member',
      'guardian',
      'sponsor',
      'customer',
      'supplier',
      'collaborator',
      'public_body',
      'federation',
      'sports_club',
      'other'
    )),
  display_name text NOT NULL,
  given_name text NULL,
  family_name text NULL,
  company_name text NULL,
  tax_code text NULL,
  vat_number text NULL,
  email text NULL,
  phone text NULL,
  pec text NULL,
  recipient_code text NULL,
  address_street text NULL,
  address_city text NULL,
  address_zip text NULL,
  address_province text NULL,
  address_country char(2) NOT NULL DEFAULT 'IT',
  iban text NULL,
  people_id uuid NULL REFERENCES public.people(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz NULL,
  archived_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_counterparties_display_name_nonempty
    CHECK (btrim(display_name) <> '')
);

COMMENT ON TABLE public.accounting_counterparties IS
  'Anagrafica contabile autonoma (non confondere con people). '
  'Soft-delete via archived_at. DELETE fisico vietato da trigger (anche service_role). '
  'Nessun seed in 012.';

CREATE INDEX IF NOT EXISTS idx_accounting_counterparties_display_name
  ON public.accounting_counterparties (display_name);
CREATE INDEX IF NOT EXISTS idx_accounting_counterparties_kind
  ON public.accounting_counterparties (kind);
CREATE INDEX IF NOT EXISTS idx_accounting_counterparties_people_id
  ON public.accounting_counterparties (people_id);
CREATE INDEX IF NOT EXISTS idx_accounting_counterparties_tax_code
  ON public.accounting_counterparties (tax_code);
CREATE INDEX IF NOT EXISTS idx_accounting_counterparties_vat_number
  ON public.accounting_counterparties (vat_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_counterparties_people_id
  ON public.accounting_counterparties (people_id)
  WHERE people_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_accounting_counterparties_updated_at
  ON public.accounting_counterparties;
CREATE TRIGGER trg_accounting_counterparties_updated_at
  BEFORE UPDATE ON public.accounting_counterparties
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

DROP TRIGGER IF EXISTS trg_accounting_counterparties_forbid_delete
  ON public.accounting_counterparties;
CREATE TRIGGER trg_accounting_counterparties_forbid_delete
  BEFORE DELETE ON public.accounting_counterparties
  FOR EACH ROW EXECUTE FUNCTION public.accounting_forbid_physical_delete();

-- -----------------------------------------------------------------------------
-- 2) accounting_receivables
-- residual_amount_cents = GENERATED STORED per evitare disallineamento.
-- Eccedenza rilevabile: (collected_amount_cents - refunded_amount_cents) > expected_amount_cents.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  counterparty_id uuid NULL
    REFERENCES public.accounting_counterparties(id) ON DELETE RESTRICT,
  person_id uuid NULL
    REFERENCES public.people(id) ON DELETE RESTRICT,
  accounting_category_id uuid NOT NULL
    REFERENCES public.accounting_categories(id) ON DELETE RESTRICT,
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NULL,
  source_reference text NULL,
  expected_amount_cents bigint NOT NULL DEFAULT 0
    CHECK (expected_amount_cents >= 0),
  collected_amount_cents bigint NOT NULL DEFAULT 0
    CHECK (collected_amount_cents >= 0),
  refunded_amount_cents bigint NOT NULL DEFAULT 0
    CHECK (refunded_amount_cents >= 0),
  residual_amount_cents bigint GENERATED ALWAYS AS (
    GREATEST(
      expected_amount_cents - (collected_amount_cents - refunded_amount_cents),
      0
    )
  ) STORED,
  currency char(3) NOT NULL DEFAULT 'EUR'
    CHECK (currency = 'EUR'),
  due_date date NULL,
  status text NOT NULL
    CHECK (status IN (
      'assigned',
      'partially_paid',
      'paid',
      'overpaid',
      'cancelled',
      'partially_refunded',
      'refunded',
      'to_review'
    )),
  nature text NOT NULL
    CHECK (nature IN ('institutional', 'commercial', 'mixed', 'to_classify')),
  include_in_commercial_limit boolean NOT NULL DEFAULT false,
  exclusion_reason text NULL,
  description text NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz NULL,
  archived_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_receivables_description_nonempty
    CHECK (btrim(description) <> ''),
  CONSTRAINT accounting_receivables_refund_le_collected
    CHECK (refunded_amount_cents <= collected_amount_cents)
);

COMMENT ON TABLE public.accounting_receivables IS
  'Crediti/importi previsti (es. da fee_assignments in futuro). '
  'Nessuna FK verso Quote. Soft-delete via archived_at; DELETE fisico vietato (anche service_role). '
  'Scritture authenticated: nessuna in 012 (solo SELECT). Sync futura via funzioni controllate. '
  'Nessun seed in 012.';
COMMENT ON COLUMN public.accounting_receivables.residual_amount_cents IS
  'GENERATED STORED: GREATEST(expected - (collected - refunded), 0).';
COMMENT ON COLUMN public.accounting_receivables.status IS
  'Non usare status per inventare pagamenti mancanti; to_review per casi da verificare.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_receivables_source
  ON public.accounting_receivables (source_system, source_table, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_receivables_fiscal_year
  ON public.accounting_receivables (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_accounting_receivables_status
  ON public.accounting_receivables (status);
CREATE INDEX IF NOT EXISTS idx_accounting_receivables_person
  ON public.accounting_receivables (person_id);
CREATE INDEX IF NOT EXISTS idx_accounting_receivables_counterparty
  ON public.accounting_receivables (counterparty_id);

DROP TRIGGER IF EXISTS trg_accounting_receivables_updated_at
  ON public.accounting_receivables;
CREATE TRIGGER trg_accounting_receivables_updated_at
  BEFORE UPDATE ON public.accounting_receivables
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

DROP TRIGGER IF EXISTS trg_accounting_receivables_forbid_delete
  ON public.accounting_receivables;
CREATE TRIGGER trg_accounting_receivables_forbid_delete
  BEFORE DELETE ON public.accounting_receivables
  FOR EACH ROW EXECUTE FUNCTION public.accounting_forbid_physical_delete();

-- -----------------------------------------------------------------------------
-- 3) accounting_movements
-- Immutabilità in 2C: nessun GRANT/policy DELETE; UPDATE solo draft/pending_account.
-- Posting/storno/rettifica: RPC SECURITY DEFINER + audit nello step dedicato
-- (nessun trigger di immutabilità qui: bloccherebbe le future RPC).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL
    REFERENCES public.accounting_fiscal_years(id) ON DELETE RESTRICT,
  entry_no integer NULL,
  movement_date date NOT NULL,
  document_date date NULL,
  competence_date date NULL,
  due_date date NULL,
  settlement_date date NULL,
  direction text NOT NULL
    CHECK (direction IN (
      'income',
      'expense',
      'transfer',
      'adjustment',
      'opening',
      'closing',
      'reversal'
    )),
  amount_cents bigint NOT NULL
    CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'EUR'
    CHECK (currency = 'EUR'),
  account_id uuid NULL
    REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL
    REFERENCES public.accounting_categories(id) ON DELETE RESTRICT,
  counterparty_id uuid NULL
    REFERENCES public.accounting_counterparties(id) ON DELETE RESTRICT,
  receivable_id uuid NULL
    REFERENCES public.accounting_receivables(id) ON DELETE RESTRICT,
  description text NOT NULL,
  notes text NULL,
  origin text NOT NULL
    CHECK (origin IN (
      'manual',
      'fee_sync',
      'backfill',
      'reversal',
      'refund',
      'adjustment'
    )),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'pending_account',
      'posted',
      'reversed',
      'cancelled'
    )),
  payment_method_raw text NULL,
  reference text NULL,
  reverses_movement_id uuid NULL,
  reversed_by_movement_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  posted_at timestamptz NULL,
  posted_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz NULL,
  verified_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_movements_description_nonempty
    CHECK (btrim(description) <> ''),
  CONSTRAINT accounting_movements_posted_needs_account
    CHECK (status <> 'posted' OR account_id IS NOT NULL),
  CONSTRAINT accounting_movements_no_self_reverse
    CHECK (reverses_movement_id IS NULL OR reverses_movement_id <> id)
);

COMMENT ON TABLE public.accounting_movements IS
  'Prima nota finanziaria (non partita doppia completa). '
  'Immutabilità posted in 2C via GRANT/policy (no DELETE; UPDATE solo draft/pending). '
  'Posting/storno/rettifica: RPC SECURITY DEFINER future + audit. '
  'Somma allocations verificata da app/RPC prima del posting. '
  'Nessun seed; entry_no non auto-generato in questo step.';

-- Self-FK: controllo nome + tabella (evita omonimi su altre tabelle)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_movements_reverses_fk'
      AND conrelid = 'public.accounting_movements'::regclass
  ) THEN
    ALTER TABLE public.accounting_movements
      ADD CONSTRAINT accounting_movements_reverses_fk
      FOREIGN KEY (reverses_movement_id)
      REFERENCES public.accounting_movements(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_movements_reversed_by_fk'
      AND conrelid = 'public.accounting_movements'::regclass
  ) THEN
    ALTER TABLE public.accounting_movements
      ADD CONSTRAINT accounting_movements_reversed_by_fk
      FOREIGN KEY (reversed_by_movement_id)
      REFERENCES public.accounting_movements(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_movements_entry_no
  ON public.accounting_movements (fiscal_year_id, entry_no)
  WHERE entry_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounting_movements_fiscal_year
  ON public.accounting_movements (fiscal_year_id);
CREATE INDEX IF NOT EXISTS idx_accounting_movements_status
  ON public.accounting_movements (status);
CREATE INDEX IF NOT EXISTS idx_accounting_movements_date
  ON public.accounting_movements (movement_date);
CREATE INDEX IF NOT EXISTS idx_accounting_movements_receivable
  ON public.accounting_movements (receivable_id);
CREATE INDEX IF NOT EXISTS idx_accounting_movements_account
  ON public.accounting_movements (account_id);

DROP TRIGGER IF EXISTS trg_accounting_movements_updated_at
  ON public.accounting_movements;
CREATE TRIGGER trg_accounting_movements_updated_at
  BEFORE UPDATE ON public.accounting_movements
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) accounting_movement_allocations
-- Somma allocations: verificata da app/RPC prima del posting (nessun trigger somma).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_movement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL
    REFERENCES public.accounting_movements(id) ON DELETE RESTRICT,
  accounting_category_id uuid NOT NULL
    REFERENCES public.accounting_categories(id) ON DELETE RESTRICT,
  team_category_id uuid NULL
    REFERENCES public.categories(id) ON DELETE RESTRICT,
  event_id uuid NULL
    REFERENCES public.events(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL
    CHECK (amount_cents > 0),
  percentage numeric(7, 4) NULL
    CHECK (percentage IS NULL OR (percentage > 0 AND percentage <= 100)),
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.accounting_movement_allocations IS
  'Ripartizione movimenti su categorie economiche / squadre / eventi. '
  'Somma verificata da app/RPC prima del posting. Nessun seed in 012. '
  'DELETE consentito solo su allocation di movimenti draft/pending_account.';

CREATE INDEX IF NOT EXISTS idx_accounting_movement_allocations_movement
  ON public.accounting_movement_allocations (movement_id);
CREATE INDEX IF NOT EXISTS idx_accounting_movement_allocations_category
  ON public.accounting_movement_allocations (accounting_category_id);
CREATE INDEX IF NOT EXISTS idx_accounting_movement_allocations_team
  ON public.accounting_movement_allocations (team_category_id);
CREATE INDEX IF NOT EXISTS idx_accounting_movement_allocations_event
  ON public.accounting_movement_allocations (event_id);

DROP TRIGGER IF EXISTS trg_accounting_movement_allocations_updated_at
  ON public.accounting_movement_allocations;
CREATE TRIGGER trg_accounting_movement_allocations_updated_at
  BEFORE UPDATE ON public.accounting_movement_allocations
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- 5) accounting_source_links — MAPPA stabile (non log eventi)
-- Eventi assignment_updated / payment_voided / ecc. → outbox (2E) + audit_log.
-- Unique (source_system, source_table, source_id, link_type):
--   assignment → un receivable; payment → un movement; refund → un movement.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  link_type text NOT NULL
    CHECK (link_type IN (
      'assignment_receivable',
      'payment_movement',
      'refund_movement',
      'legacy_receivable',
      'legacy_movement'
    )),
  receivable_id uuid NULL
    REFERENCES public.accounting_receivables(id) ON DELETE RESTRICT,
  movement_id uuid NULL
    REFERENCES public.accounting_movements(id) ON DELETE RESTRICT,
  payload_hash text NULL,
  source_occurred_at timestamptz NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text NULL,
  CONSTRAINT accounting_source_links_target_present
    CHECK (receivable_id IS NOT NULL OR movement_id IS NOT NULL),
  CONSTRAINT accounting_source_links_type_targets
    CHECK (
      (
        link_type IN ('assignment_receivable', 'legacy_receivable')
        AND receivable_id IS NOT NULL
        AND movement_id IS NULL
      )
      OR (
        link_type IN ('payment_movement', 'refund_movement', 'legacy_movement')
        AND movement_id IS NOT NULL
        AND receivable_id IS NULL
      )
    ),
  CONSTRAINT accounting_source_links_unique
    UNIQUE (source_system, source_table, source_id, link_type)
);

COMMENT ON TABLE public.accounting_source_links IS
  'Mappa stabile sorgente→Contabilità (non log eventi). '
  'link_type: assignment_receivable | payment_movement | refund_movement | legacy_*. '
  'Aggiornamenti ripetuti della stessa assegnazione aggiornano il receivable collegato; '
  'non creano nuovi source_links. Eventi (updated/voided/adjusted) → outbox 2E + audit_log. '
  'Nessuna FK verso fee_assignments/payments. Nessun seed in 012.';

CREATE INDEX IF NOT EXISTS idx_accounting_source_links_receivable
  ON public.accounting_source_links (receivable_id);
CREATE INDEX IF NOT EXISTS idx_accounting_source_links_movement
  ON public.accounting_source_links (movement_id);
CREATE INDEX IF NOT EXISTS idx_accounting_source_links_source
  ON public.accounting_source_links (source_system, source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_source_links_link_type
  ON public.accounting_source_links (link_type);

-- -----------------------------------------------------------------------------
-- 6) accounting_audit_log (append-only intenzionale)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounting_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb NULL,
  new_value jsonb NULL,
  actor_profile_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text NULL,
  origin text NOT NULL
    CHECK (origin IN (
      'ui',
      'database',
      'fee_sync',
      'backfill',
      'reconcile',
      'system'
    )),
  correlation_id uuid NULL,
  metadata jsonb NULL,
  CONSTRAINT accounting_audit_log_entity_type_nonempty
    CHECK (btrim(entity_type) <> ''),
  CONSTRAINT accounting_audit_log_action_nonempty
    CHECK (btrim(action) <> '')
);

COMMENT ON TABLE public.accounting_audit_log IS
  'Audit Contabilità append-only INTENZIONALE: trigger blocca UPDATE/DELETE anche per service_role. '
  'Nessun GRANT INSERT/UPDATE/DELETE ad authenticated; INSERT via service_role / funzioni future. '
  'Non salvare password/token/segreti. Nessun seed in 012.';

CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_entity
  ON public.accounting_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_occurred
  ON public.accounting_audit_log (occurred_at);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_log_actor
  ON public.accounting_audit_log (actor_profile_id);

DROP TRIGGER IF EXISTS trg_accounting_audit_log_protect
  ON public.accounting_audit_log;
CREATE TRIGGER trg_accounting_audit_log_protect
  BEFORE UPDATE OR DELETE ON public.accounting_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.accounting_protect_audit_append_only();

-- -----------------------------------------------------------------------------
-- 7) GRANT / REVOKE — minimo privilegio (coerente 010/011)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounting_counterparties FROM anon;
REVOKE ALL ON TABLE public.accounting_receivables FROM anon;
REVOKE ALL ON TABLE public.accounting_movements FROM anon;
REVOKE ALL ON TABLE public.accounting_movement_allocations FROM anon;
REVOKE ALL ON TABLE public.accounting_source_links FROM anon;
REVOKE ALL ON TABLE public.accounting_audit_log FROM anon;

REVOKE ALL ON TABLE public.accounting_counterparties FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_receivables FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_movements FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_movement_allocations FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_source_links FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_audit_log FROM PUBLIC;

REVOKE ALL ON TABLE public.accounting_counterparties FROM authenticated;
REVOKE ALL ON TABLE public.accounting_receivables FROM authenticated;
REVOKE ALL ON TABLE public.accounting_movements FROM authenticated;
REVOKE ALL ON TABLE public.accounting_movement_allocations FROM authenticated;
REVOKE ALL ON TABLE public.accounting_source_links FROM authenticated;
REVOKE ALL ON TABLE public.accounting_audit_log FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_counterparties TO authenticated;
GRANT SELECT ON TABLE public.accounting_receivables TO authenticated;
-- movements: nessun DELETE
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.accounting_movement_allocations TO authenticated;
GRANT SELECT ON TABLE public.accounting_source_links TO authenticated;
-- audit: nessun INSERT/UPDATE/DELETE ad authenticated
GRANT SELECT ON TABLE public.accounting_audit_log TO authenticated;

GRANT ALL ON TABLE public.accounting_counterparties TO service_role;
GRANT ALL ON TABLE public.accounting_receivables TO service_role;
GRANT ALL ON TABLE public.accounting_movements TO service_role;
GRANT ALL ON TABLE public.accounting_movement_allocations TO service_role;
GRANT ALL ON TABLE public.accounting_source_links TO service_role;
GRANT ALL ON TABLE public.accounting_audit_log TO service_role;

-- -----------------------------------------------------------------------------
-- 8) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.accounting_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_movement_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_source_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_audit_log ENABLE ROW LEVEL SECURITY;

-- --- counterparties ---
DROP POLICY IF EXISTS accounting_counterparties_select ON public.accounting_counterparties;
CREATE POLICY accounting_counterparties_select ON public.accounting_counterparties
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_counterparties_insert ON public.accounting_counterparties;
CREATE POLICY accounting_counterparties_insert ON public.accounting_counterparties
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.create')
  );

DROP POLICY IF EXISTS accounting_counterparties_update ON public.accounting_counterparties;
CREATE POLICY accounting_counterparties_update ON public.accounting_counterparties
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.edit_draft')
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- --- receivables: SELECT only ---
DROP POLICY IF EXISTS accounting_receivables_select ON public.accounting_receivables;
CREATE POLICY accounting_receivables_select ON public.accounting_receivables
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- --- movements ---
DROP POLICY IF EXISTS accounting_movements_select ON public.accounting_movements;
CREATE POLICY accounting_movements_select ON public.accounting_movements
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

-- INSERT: accounting.create (Admin via is_app_admin o permesso); solo draft/pending_account
DROP POLICY IF EXISTS accounting_movements_insert ON public.accounting_movements;
CREATE POLICY accounting_movements_insert ON public.accounting_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_app_admin()
      OR public.has_accounting_permission('accounting.create')
    )
    AND status IN ('draft', 'pending_account')
  );

-- UPDATE: edit_draft; USING = vecchio draft/pending; WITH CHECK = nuovo draft/pending
-- Nessuna policy Admin generica su posted. Posting/storno → RPC future.
DROP POLICY IF EXISTS accounting_movements_update ON public.accounting_movements;
CREATE POLICY accounting_movements_update ON public.accounting_movements
  FOR UPDATE TO authenticated
  USING (
    public.has_accounting_permission('accounting.edit_draft')
    AND status IN ('draft', 'pending_account')
  )
  WITH CHECK (
    public.has_accounting_permission('accounting.edit_draft')
    AND status IN ('draft', 'pending_account')
  );

-- Nessuna policy DELETE su movements.

-- --- allocations ---
DROP POLICY IF EXISTS accounting_movement_allocations_select
  ON public.accounting_movement_allocations;
CREATE POLICY accounting_movement_allocations_select
  ON public.accounting_movement_allocations
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_movement_allocations_insert
  ON public.accounting_movement_allocations;
CREATE POLICY accounting_movement_allocations_insert
  ON public.accounting_movement_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_accounting_permission('accounting.edit_draft')
    AND EXISTS (
      SELECT 1
      FROM public.accounting_movements m
      WHERE m.id = movement_id
        AND m.status IN ('draft', 'pending_account')
    )
  );

DROP POLICY IF EXISTS accounting_movement_allocations_update
  ON public.accounting_movement_allocations;
CREATE POLICY accounting_movement_allocations_update
  ON public.accounting_movement_allocations
  FOR UPDATE TO authenticated
  USING (
    public.has_accounting_permission('accounting.edit_draft')
    AND EXISTS (
      SELECT 1
      FROM public.accounting_movements m
      WHERE m.id = movement_id
        AND m.status IN ('draft', 'pending_account')
    )
  )
  WITH CHECK (
    public.has_accounting_permission('accounting.edit_draft')
    AND EXISTS (
      SELECT 1
      FROM public.accounting_movements m
      WHERE m.id = movement_id
        AND m.status IN ('draft', 'pending_account')
    )
  );

DROP POLICY IF EXISTS accounting_movement_allocations_delete
  ON public.accounting_movement_allocations;
CREATE POLICY accounting_movement_allocations_delete
  ON public.accounting_movement_allocations
  FOR DELETE TO authenticated
  USING (
    public.has_accounting_permission('accounting.edit_draft')
    AND EXISTS (
      SELECT 1
      FROM public.accounting_movements m
      WHERE m.id = movement_id
        AND m.status IN ('draft', 'pending_account')
    )
  );

-- --- source_links: SELECT only ---
DROP POLICY IF EXISTS accounting_source_links_select ON public.accounting_source_links;
CREATE POLICY accounting_source_links_select ON public.accounting_source_links
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.verify')
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- --- audit_log: SELECT only ---
DROP POLICY IF EXISTS accounting_audit_log_select ON public.accounting_audit_log;
CREATE POLICY accounting_audit_log_select ON public.accounting_audit_log
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.audit_view')
  );

COMMIT;
