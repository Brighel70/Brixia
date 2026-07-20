-- =============================================================================
-- 019_accounting_category_settings.sql
-- =============================================================================
-- STEP 4C — Gruppi e impostazioni categorie economiche Contabilità.
--
-- Crea:
--   - accounting_category_groups (gruppi income|expense, non "both")
--   - colonne su accounting_categories: group_id, available_in_*, recommended_active
--   - trigger coerenza gruppo/categoria + protezione gruppi di sistema
--   - seed gruppi di sistema + catalogo categorie consigliate
--   - mapping idempotente QUOTE / ALTRE_* / SPONSOR (preserva id/code)
--   - RPC: activation batch, create/update custom, reset configurazione consigliata
--   - RLS/GRANT (pattern 016: view + manage_settings; nessun DELETE)
--
-- NON modifica: Quote, FlowMe, movements, receivables, migration 010–017.
-- Applicare dopo 018_accounting_commercial_vat.
-- NON APPLICARE senza revisione e approvazione.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1) accounting_category_groups
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accounting_category_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL
    CHECK (direction IN ('income', 'expense')),
  code text NOT NULL,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived_at timestamptz NULL,
  archived_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT accounting_category_groups_code_not_blank
    CHECK (btrim(code) <> ''),
  CONSTRAINT accounting_category_groups_name_not_blank
    CHECK (btrim(name) <> ''),
  CONSTRAINT accounting_category_groups_direction_code_unique
    UNIQUE (direction, code)
);

COMMENT ON TABLE public.accounting_category_groups IS
  'Gruppi contabili per categorie economiche (income|expense). '
  'Distinti da public.categories (squadre TeamFlow).';

CREATE INDEX IF NOT EXISTS idx_accounting_category_groups_direction
  ON public.accounting_category_groups (direction);

CREATE INDEX IF NOT EXISTS idx_accounting_category_groups_is_active
  ON public.accounting_category_groups (is_active);

CREATE INDEX IF NOT EXISTS idx_accounting_category_groups_sort_order
  ON public.accounting_category_groups (sort_order);

DROP TRIGGER IF EXISTS trg_accounting_category_groups_updated_at
  ON public.accounting_category_groups;
CREATE TRIGGER trg_accounting_category_groups_updated_at
  BEFORE UPDATE ON public.accounting_category_groups
  FOR EACH ROW EXECUTE FUNCTION public.accounting_set_updated_at();

-- -----------------------------------------------------------------------------
-- Protezione gruppi: UPDATE/DELETE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_category_groups_protect()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system IS TRUE THEN
      RAISE EXCEPTION
        'accounting_category_groups_protect: DELETE vietato su gruppo di sistema (%)'
        , OLD.code;
    END IF;
    -- Custom: FK ON DELETE RESTRICT su categories impedisce DELETE se referenziato
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.is_system IS TRUE THEN
    IF NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION
        'accounting_category_groups_protect: code immutabile su gruppo di sistema (%)'
        , OLD.code;
    END IF;
    IF NEW.direction IS DISTINCT FROM OLD.direction THEN
      RAISE EXCEPTION
        'accounting_category_groups_protect: direction immutabile su gruppo di sistema (%)'
        , OLD.code;
    END IF;
    IF NEW.is_system IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION
        'accounting_category_groups_protect: is_system non rimovibile su gruppo (%)'
        , OLD.code;
    END IF;
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
       AND NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION
        'accounting_category_groups_protect: soft-archive vietato su gruppo di sistema (%)'
        , OLD.code;
    END IF;
  END IF;

  -- Soft-archive OK solo per gruppi custom (non-system).
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_category_groups_protect() IS
  'BEFORE UPDATE/DELETE: vieta DELETE e mutazione code/direction su gruppi is_system.';

REVOKE ALL ON FUNCTION public.accounting_category_groups_protect() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_groups_protect() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_category_groups_protect() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_groups_protect() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_groups_protect() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_category_groups_protect
  ON public.accounting_category_groups;
CREATE TRIGGER trg_accounting_category_groups_protect
  BEFORE UPDATE OR DELETE ON public.accounting_category_groups
  FOR EACH ROW EXECUTE FUNCTION public.accounting_category_groups_protect();

-- =============================================================================
-- 2) ALTER accounting_categories — colonne impostazioni
-- =============================================================================
ALTER TABLE public.accounting_categories
  ADD COLUMN IF NOT EXISTS group_id uuid NULL
    REFERENCES public.accounting_category_groups(id) ON DELETE RESTRICT;

ALTER TABLE public.accounting_categories
  ADD COLUMN IF NOT EXISTS available_in_movements boolean NOT NULL DEFAULT true;

ALTER TABLE public.accounting_categories
  ADD COLUMN IF NOT EXISTS available_in_budget boolean NOT NULL DEFAULT true;

ALTER TABLE public.accounting_categories
  ADD COLUMN IF NOT EXISTS available_in_reports boolean NOT NULL DEFAULT true;

ALTER TABLE public.accounting_categories
  ADD COLUMN IF NOT EXISTS recommended_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.accounting_categories.group_id IS
  'Gruppo contabile (income|expense). Direction categoria deve coincidere col gruppo.';
COMMENT ON COLUMN public.accounting_categories.available_in_movements IS
  'Se true, categoria selezionabile nei movimenti.';
COMMENT ON COLUMN public.accounting_categories.available_in_budget IS
  'Se true, categoria selezionabile nel preventivo.';
COMMENT ON COLUMN public.accounting_categories.available_in_reports IS
  'Se true, categoria inclusa nei report.';
COMMENT ON COLUMN public.accounting_categories.recommended_active IS
  'Flag configurazione consigliata (Ripristina). Non equivale a is_active runtime.';

CREATE INDEX IF NOT EXISTS idx_accounting_categories_group_id
  ON public.accounting_categories (group_id);

-- =============================================================================
-- 3) Trigger coerenza categorie ↔ gruppi
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accounting_category_enforce_group_coherence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_grp public.accounting_category_groups%ROWTYPE;
BEGIN
  -- QUOTE: regole forzate (seed + ogni mutazione)
  IF upper(btrim(NEW.code)) = 'QUOTE' THEN
    NEW.is_system := true;
    NEW.is_active := true;
    NEW.direction := 'income';
    NEW.default_nature := 'institutional';
    NEW.include_in_commercial_limit := false;
    IF TG_OP = 'UPDATE' AND NEW.is_active IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: QUOTE non disattivabile';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system IS TRUE THEN
      IF NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION
          'accounting_category_enforce_group_coherence: code immutabile su categoria di sistema (%)'
          , OLD.code;
      END IF;
      IF NEW.direction IS DISTINCT FROM OLD.direction THEN
        RAISE EXCEPTION
          'accounting_category_enforce_group_coherence: direction immutabile su categoria di sistema (%)'
          , OLD.code;
      END IF;
    END IF;

    -- Escalation is_system false→true non consentita via UPDATE client
    IF COALESCE(OLD.is_system, false) IS FALSE
       AND NEW.is_system IS TRUE THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: is_system solo via seed/RPC interna';
    END IF;
  END IF;

  IF NEW.group_id IS NOT NULL THEN
    SELECT * INTO v_grp
    FROM public.accounting_category_groups g
    WHERE g.id = NEW.group_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: group_id % non trovato'
        , NEW.group_id;
    END IF;

    IF v_grp.archived_at IS NOT NULL AND TG_OP = 'INSERT' THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: gruppo archiviato (%), INSERT vietato'
        , v_grp.code;
    END IF;

    -- direction deve coincidere col gruppo (niente "both" sotto income/expense)
    IF NEW.direction IS DISTINCT FROM v_grp.direction THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: direction categoria (%) ≠ gruppo (%)'
        , NEW.direction, v_grp.direction;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_category_enforce_group_coherence() IS
  'BEFORE INSERT/UPDATE: coerenza group_id/direction, regole QUOTE e protezione system.';

REVOKE ALL ON FUNCTION public.accounting_category_enforce_group_coherence() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_enforce_group_coherence() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_category_enforce_group_coherence() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_enforce_group_coherence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_enforce_group_coherence() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_category_enforce_group_coherence
  ON public.accounting_categories;
CREATE TRIGGER trg_accounting_category_enforce_group_coherence
  BEFORE INSERT OR UPDATE OF group_id, direction, code, is_active, is_system
  ON public.accounting_categories
  FOR EACH ROW EXECUTE FUNCTION public.accounting_category_enforce_group_coherence();

-- =============================================================================
-- 4) Helper seed: resolve group id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.accounting_category_group_id_by_code(
  p_direction text,
  p_code text
)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT g.id
  FROM public.accounting_category_groups g
  WHERE g.direction = p_direction
    AND upper(g.code) = upper(btrim(p_code))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.accounting_category_group_id_by_code(text, text) IS
  'Helper seed/RPC: id gruppo per (direction, code).';

REVOKE ALL ON FUNCTION public.accounting_category_group_id_by_code(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_group_id_by_code(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_category_group_id_by_code(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_group_id_by_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_group_id_by_code(text, text) TO service_role;

-- Helper normalizzazione code
CREATE OR REPLACE FUNCTION public.accounting_normalize_category_code(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT NULLIF(
    upper(
      regexp_replace(
        regexp_replace(btrim(COALESCE(p_code, '')), '[^a-zA-Z0-9]+', '_', 'g'),
        '_+', '_', 'g'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.accounting_normalize_category_code(text) IS
  'Normalizza code categoria/gruppo: UPPER + underscore.';

REVOKE ALL ON FUNCTION public.accounting_normalize_category_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_normalize_category_code(text) FROM anon;
REVOKE ALL ON FUNCTION public.accounting_normalize_category_code(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_normalize_category_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_normalize_category_code(text) TO service_role;

-- =============================================================================
-- 5) Seed gruppi di sistema (idempotente su direction+code)
-- =============================================================================
INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'income', 'QUOTE_SPORT', 'Quote e attività sportive',
  'Quote associative/sportive e attività correlate.', true, true, 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'income' AND code = 'QUOTE_SPORT'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'income', 'SPONSOR_PUB', 'Sponsorizzazioni e pubblicità',
  'Sponsor, pubblicità e proventi commerciali correlati.', true, true, 20
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'income' AND code = 'SPONSOR_PUB'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'income', 'RICAVI_EVENTI', 'Ricavi da eventi e attività',
  'Biglietteria, tornei e ricavi da eventi.', true, true, 30
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'income' AND code = 'RICAVI_EVENTI'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'income', 'CONTRIBUTI', 'Contributi e contributi pubblici',
  'Contributi pubblici e donazioni istituzionali.', true, true, 40
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'income' AND code = 'CONTRIBUTI'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'income', 'ALTRE_ENTRATE_G', 'Altre entrate',
  'Residuale entrate da classificare.', true, true, 90
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'income' AND code = 'ALTRE_ENTRATE_G'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'expense', 'COSTI_SPORTIVI', 'Costi sportivi e tecnici',
  'Materiale, arbitri, trasferte e costi tecnici.', true, true, 10
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'expense' AND code = 'COSTI_SPORTIVI'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'expense', 'STRUTTURA', 'Struttura, impianti e utenze',
  'Affitti campi, utenze, manutenzione impianti.', true, true, 20
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'expense' AND code = 'STRUTTURA'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'expense', 'PERSONALE', 'Compensi e collaborazioni',
  'Compensi tecnici e collaborazioni.', true, true, 30
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'expense' AND code = 'PERSONALE'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'expense', 'AMMINISTRAZIONE', 'Amministrazione e servizi generali',
  'Consulenze, software, spese bancarie e admin.', true, true, 40
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'expense' AND code = 'AMMINISTRAZIONE'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'expense', 'ASSICURAZIONI', 'Assicurazioni e tesseramenti',
  'Assicurazioni sportive e tesseramenti.', true, true, 50
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'expense' AND code = 'ASSICURAZIONI'
);

INSERT INTO public.accounting_category_groups (
  direction, code, name, description, is_active, is_system, sort_order
)
SELECT 'expense', 'ALTRE_USCITE_G', 'Altre uscite',
  'Residuale uscite da classificare.', true, true, 90
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_category_groups
  WHERE direction = 'expense' AND code = 'ALTRE_USCITE_G'
);

-- =============================================================================
-- 6) Map categorie esistenti (UPDATE by code — preserva id)
-- =============================================================================
UPDATE public.accounting_categories c
SET
  group_id = public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT'),
  available_in_movements = true,
  available_in_budget = true,
  available_in_reports = true,
  is_active = true,
  recommended_active = true,
  is_system = true,
  direction = 'income',
  default_nature = 'institutional',
  include_in_commercial_limit = false,
  updated_at = now()
WHERE upper(c.code) = 'QUOTE';

UPDATE public.accounting_categories c
SET
  group_id = public.accounting_category_group_id_by_code('income', 'ALTRE_ENTRATE_G'),
  available_in_movements = true,
  available_in_budget = true,
  available_in_reports = true,
  recommended_active = true,
  updated_at = now()
WHERE upper(c.code) = 'ALTRE_ENTRATE';

UPDATE public.accounting_categories c
SET
  group_id = public.accounting_category_group_id_by_code('expense', 'ALTRE_USCITE_G'),
  available_in_movements = true,
  available_in_budget = true,
  available_in_reports = true,
  recommended_active = true,
  updated_at = now()
WHERE upper(c.code) = 'ALTRE_USCITE';

-- SPONSOR (se presente da VAT / seed successivo): mappa, non duplicare
UPDATE public.accounting_categories c
SET
  group_id = public.accounting_category_group_id_by_code('income', 'SPONSOR_PUB'),
  available_in_movements = true,
  available_in_budget = true,
  available_in_reports = true,
  recommended_active = true,
  is_active = true,
  direction = 'income',
  default_nature = COALESCE(c.default_nature, 'commercial'),
  include_in_commercial_limit = COALESCE(c.include_in_commercial_limit, true),
  updated_at = now()
WHERE upper(c.code) = 'SPONSOR';

-- =============================================================================
-- 7) Seed catalogo categorie aggiuntive
-- =============================================================================
-- Helper locale via INSERT...SELECT + group resolve.
-- is_system=true per seed catalogo. recommended_active = is_active iniziale.

-- --- INCOME ACTIVE ---
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'SPONSORIZZAZIONI',
  'Sponsorizzazioni',
  'income',
  'commercial',
  true,
  true,
  true,
  true,
  20,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. '
  'Natura commerciale e inclusione limite 398 sono ipotesi iniziali.',
  public.accounting_category_group_id_by_code('income', 'SPONSOR_PUB'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories
  WHERE upper(code) IN ('SPONSOR', 'SPONSORIZZAZIONI')
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'PUBBLICITA',
  'Pubblicità',
  'income',
  'commercial',
  true,
  true,
  true,
  true,
  25,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. '
  'Natura commerciale e inclusione limite 398 sono ipotesi iniziali.',
  public.accounting_category_group_id_by_code('income', 'SPONSOR_PUB'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'PUBBLICITA'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'BIGLIETTERIA',
  'Biglietteria eventi',
  'income',
  'commercial',
  true,
  true,
  true,
  true,
  30,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. '
  'Natura commerciale e inclusione limite 398 sono ipotesi iniziali.',
  public.accounting_category_group_id_by_code('income', 'RICAVI_EVENTI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'BIGLIETTERIA'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'CONTRIBUTI_PUBBLICI',
  'Contributi pubblici',
  'income',
  'institutional',
  false,
  true,
  true,
  true,
  40,
  'Ipotesi istituzionale. Verificare con commercialista classificazione e limiti.',
  public.accounting_category_group_id_by_code('income', 'CONTRIBUTI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'CONTRIBUTI_PUBBLICI'
);

-- --- EXPENSE ACTIVE ---
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'MATERIALE_SPORTIVO',
  'Materiale sportivo',
  'expense',
  'institutional',
  false,
  true,
  true,
  true,
  10,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'COSTI_SPORTIVI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'MATERIALE_SPORTIVO'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'AFFITTO_CAMPI',
  'Affitto campi / impianti',
  'expense',
  'institutional',
  false,
  true,
  true,
  true,
  20,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'STRUTTURA'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'AFFITTO_CAMPI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'UTENZE',
  'Utenze',
  'expense',
  'institutional',
  false,
  true,
  true,
  true,
  25,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'STRUTTURA'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'UTENZE'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'COMPENSI_TECNICI',
  'Compensi tecnici',
  'expense',
  'institutional',
  false,
  true,
  true,
  true,
  30,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'PERSONALE'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'COMPENSI_TECNICI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'ASSICURAZIONI_SPORT',
  'Assicurazioni sportive',
  'expense',
  'institutional',
  false,
  true,
  true,
  true,
  50,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'ASSICURAZIONI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'ASSICURAZIONI_SPORT'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'SPESE_VIAGGIO',
  'Spese di viaggio',
  'expense',
  'institutional',
  false,
  true,
  true,
  true,
  15,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'COSTI_SPORTIVI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'SPESE_VIAGGIO'
);

-- --- INCOME INACTIVE (catalogo settings) ---
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'MERCHANDISING',
  'Merchandising',
  'income',
  'commercial',
  true,
  true,
  false,
  false,
  35,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA. '
  'Presente in settings; non attiva nei menu operativi di default.',
  public.accounting_category_group_id_by_code('income', 'SPONSOR_PUB'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'MERCHANDISING'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'SERVIZI_COMMERCIALI',
  'Servizi commerciali',
  'income',
  'commercial',
  true,
  true,
  false,
  false,
  36,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.',
  public.accounting_category_group_id_by_code('income', 'SPONSOR_PUB'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'SERVIZI_COMMERCIALI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'RICAVI_TORNEI',
  'Ricavi da tornei',
  'income',
  'to_classify',
  false,
  true,
  false,
  false,
  32,
  'Da classificare con commercialista (istituzionale vs commerciale).',
  public.accounting_category_group_id_by_code('income', 'RICAVI_EVENTI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'RICAVI_TORNEI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'QUOTE_GARA',
  'Quote gara',
  'income',
  'institutional',
  false,
  true,
  false,
  false,
  12,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('income', 'QUOTE_SPORT'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'QUOTE_GARA'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'RIMBORSI_ASSICURATIVI',
  'Rimborsi assicurativi',
  'income',
  'institutional',
  false,
  true,
  false,
  false,
  91,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('income', 'ALTRE_ENTRATE_G'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'RIMBORSI_ASSICURATIVI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'DONAZIONI',
  'Donazioni',
  'income',
  'institutional',
  false,
  true,
  false,
  false,
  42,
  'Ipotesi istituzionale. Verificare con commercialista.',
  public.accounting_category_group_id_by_code('income', 'CONTRIBUTI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'DONAZIONI'
);

-- --- EXPENSE INACTIVE ---
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'MATERIALE_MEDICO',
  'Materiale medico',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  11,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'COSTI_SPORTIVI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'MATERIALE_MEDICO'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'ARBITRI',
  'Arbitri',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  12,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'COSTI_SPORTIVI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'ARBITRI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'TRASFERTE_GARA',
  'Trasferte gara',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  13,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'COSTI_SPORTIVI'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'TRASFERTE_GARA'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'MANUTENZIONE_IMPIANTI',
  'Manutenzione impianti',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  22,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'STRUTTURA'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'MANUTENZIONE_IMPIANTI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'NOLEGGI',
  'Noleggi',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  23,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'STRUTTURA'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'NOLEGGI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'CONSULENZE',
  'Consulenze',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  40,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'AMMINISTRAZIONE'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'CONSULENZE'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'SOFTWARE_GESTIONALE',
  'Software gestionale',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  41,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'AMMINISTRAZIONE'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'SOFTWARE_GESTIONALE'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'SPESE_BANCARIE',
  'Spese bancarie',
  'expense',
  'institutional',
  false,
  true,
  false,
  false,
  42,
  'Catalogo settings; non attiva di default nei menu operativi.',
  public.accounting_category_group_id_by_code('expense', 'AMMINISTRAZIONE'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'SPESE_BANCARIE'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'MULTE_SANZIONI',
  'Multe e sanzioni',
  'expense',
  'to_classify',
  false,
  true,
  false,
  false,
  91,
  'Da classificare con commercialista.',
  public.accounting_category_group_id_by_code('expense', 'ALTRE_USCITE_G'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'MULTE_SANZIONI'
);

INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'AMMORTAMENTI',
  'Ammortamenti',
  'expense',
  'to_classify',
  false,
  true,
  false,
  false,
  92,
  'PARAMETRO NON VERIFICATO — RICHIEDE CONFERMA DEL COMMERCIALISTA.',
  public.accounting_category_group_id_by_code('expense', 'ALTRE_USCITE_G'),
  true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(code) = 'AMMORTAMENTI'
);

-- =============================================================================
-- 8) RPC — activation batch / CRUD custom / reset consigliata
-- =============================================================================

-- -----------------------------------------------------------------------------
-- accounting_categories_save_activation_batch
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_categories_save_activation_batch(
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_corr uuid := gen_random_uuid();
  v_grp jsonb;
  v_cat jsonb;
  v_id uuid;
  v_is_active boolean;
  v_avail_m boolean;
  v_avail_b boolean;
  v_avail_r boolean;
  v_old public.accounting_categories%ROWTYPE;
  v_old_g public.accounting_category_groups%ROWTYPE;
  v_groups_updated int := 0;
  v_cats_updated int := 0;
  v_quote_forced int := 0;
  v_has_active_quote boolean;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  ) THEN
    RAISE EXCEPTION
      'accounting_categories_save_activation_batch: permesso manage_settings o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_categories_save_activation_batch: utente autenticato richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION
      'accounting_categories_save_activation_batch: p_payload oggetto jsonb obbligatorio';
  END IF;

  -- 1) Applica gruppi dal payload
  FOR v_grp IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_payload->'groups', '[]'::jsonb))
  LOOP
    BEGIN
      v_id := (v_grp->>'id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION
        'accounting_categories_save_activation_batch: group.id non valido (%)'
        , v_grp->>'id';
    END;

    IF v_id IS NULL THEN
      RAISE EXCEPTION
        'accounting_categories_save_activation_batch: group.id obbligatorio';
    END IF;

    SELECT * INTO v_old_g
    FROM public.accounting_category_groups
    WHERE id = v_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'accounting_categories_save_activation_batch: gruppo % non trovato', v_id;
    END IF;

    v_is_active := COALESCE((v_grp->>'is_active')::boolean, v_old_g.is_active);

    -- Non disattivare gruppo se ha QUOTE figlio attivo protetto
    IF v_is_active IS FALSE THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.accounting_categories c
        WHERE c.group_id = v_id
          AND upper(c.code) = 'QUOTE'
          AND c.is_active IS TRUE
      ) INTO v_has_active_quote;

      IF v_has_active_quote THEN
        v_is_active := true;
      END IF;
    END IF;

    UPDATE public.accounting_category_groups
    SET is_active = v_is_active,
        updated_by = v_uid
    WHERE id = v_id;

    v_groups_updated := v_groups_updated + 1;
  END LOOP;

  -- 2) Applica categorie dal payload
  FOR v_cat IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_payload->'categories', '[]'::jsonb))
  LOOP
    BEGIN
      v_id := (v_cat->>'id')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION
        'accounting_categories_save_activation_batch: category.id non valido (%)'
        , v_cat->>'id';
    END;

    IF v_id IS NULL THEN
      RAISE EXCEPTION
        'accounting_categories_save_activation_batch: category.id obbligatorio';
    END IF;

    SELECT * INTO v_old
    FROM public.accounting_categories
    WHERE id = v_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'accounting_categories_save_activation_batch: categoria % non trovata', v_id;
    END IF;

    v_is_active := COALESCE((v_cat->>'is_active')::boolean, v_old.is_active);
    v_avail_m := COALESCE(
      (v_cat->>'available_in_movements')::boolean, v_old.available_in_movements
    );
    v_avail_b := COALESCE(
      (v_cat->>'available_in_budget')::boolean, v_old.available_in_budget
    );
    v_avail_r := COALESCE(
      (v_cat->>'available_in_reports')::boolean, v_old.available_in_reports
    );

    IF upper(v_old.code) = 'QUOTE' THEN
      v_is_active := true;
      v_quote_forced := v_quote_forced + 1;
    END IF;

    UPDATE public.accounting_categories
    SET is_active = v_is_active,
        available_in_movements = v_avail_m,
        available_in_budget = v_avail_b,
        available_in_reports = v_avail_r,
        updated_by = v_uid
    WHERE id = v_id;

    v_cats_updated := v_cats_updated + 1;
  END LOOP;

  -- 3) Sync is_active gruppi toccati dalle categorie (figlio attivo → gruppo attivo)
  UPDATE public.accounting_category_groups g
  SET
    is_active = EXISTS (
      SELECT 1
      FROM public.accounting_categories c
      WHERE c.group_id = g.id
        AND c.is_active IS TRUE
        AND c.archived_at IS NULL
    ),
    updated_by = v_uid
  WHERE g.id IN (
    SELECT DISTINCT c.group_id
    FROM public.accounting_categories c
    WHERE c.group_id IS NOT NULL
      AND c.id IN (
        SELECT (value->>'id')::uuid
        FROM jsonb_array_elements(COALESCE(p_payload->'categories', '[]'::jsonb))
        WHERE value ? 'id'
      )
  );

  -- Forza gruppi con QUOTE attiva (mai disattivabili indirettamente)
  UPDATE public.accounting_category_groups g
  SET is_active = true,
      updated_by = v_uid
  WHERE EXISTS (
    SELECT 1 FROM public.accounting_categories c
    WHERE c.group_id = g.id
      AND upper(c.code) = 'QUOTE'
      AND c.is_active IS TRUE
  )
  AND g.is_active IS DISTINCT FROM TRUE;

  PERFORM public.accounting_audit_write(
    'accounting_categories',
    COALESCE(
      (
        SELECT (value->>'id')::uuid
        FROM jsonb_array_elements(COALESCE(p_payload->'categories', '[]'::jsonb))
        WHERE value ? 'id'
        LIMIT 1
      ),
      (
        SELECT (value->>'id')::uuid
        FROM jsonb_array_elements(COALESCE(p_payload->'groups', '[]'::jsonb))
        WHERE value ? 'id'
        LIMIT 1
      ),
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    'categories_activation_batch',
    NULL,
    p_payload,
    NULL,
    'ui',
    v_corr,
    jsonb_build_object(
      'groups_updated', v_groups_updated,
      'categories_updated', v_cats_updated,
      'quote_forced_active', v_quote_forced
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'groups_updated', v_groups_updated,
    'categories_updated', v_cats_updated,
    'quote_forced_active', v_quote_forced,
    'correlation_id', v_corr
  );
END;
$$;

COMMENT ON FUNCTION public.accounting_categories_save_activation_batch(jsonb) IS
  'Batch attivazione gruppi/categorie (manage_settings). QUOTE sempre attiva. Audit.';

REVOKE ALL ON FUNCTION public.accounting_categories_save_activation_batch(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_categories_save_activation_batch(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_categories_save_activation_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_categories_save_activation_batch(jsonb) TO service_role;

-- -----------------------------------------------------------------------------
-- accounting_category_group_create
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_category_group_create(
  p_direction text,
  p_code text,
  p_name text,
  p_description text DEFAULT NULL,
  p_sort_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_id uuid;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  ) THEN
    RAISE EXCEPTION
      'accounting_category_group_create: permesso manage_settings o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_category_group_create: utente autenticato richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_direction NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION
      'accounting_category_group_create: direction deve essere income|expense';
  END IF;

  v_code := public.accounting_normalize_category_code(p_code);
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'accounting_category_group_create: code obbligatorio';
  END IF;

  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'accounting_category_group_create: name obbligatorio';
  END IF;

  INSERT INTO public.accounting_category_groups (
    direction, code, name, description,
    is_active, is_system, sort_order, created_by, updated_by
  ) VALUES (
    p_direction, v_code, btrim(p_name), NULLIF(btrim(COALESCE(p_description, '')), ''),
    COALESCE(p_is_active, true), false, COALESCE(p_sort_order, 0), v_uid, v_uid
  )
  RETURNING id INTO v_id;

  PERFORM public.accounting_audit_write(
    'accounting_category_groups',
    v_id,
    'category_group_created',
    NULL,
    jsonb_build_object(
      'direction', p_direction,
      'code', v_code,
      'name', btrim(p_name)
    ),
    NULL,
    'ui',
    NULL,
    NULL
  );

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_category_group_create(text, text, text, text, integer, boolean) IS
  'Crea gruppo custom (is_system=false). manage_settings.';

REVOKE ALL ON FUNCTION public.accounting_category_group_create(text, text, text, text, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_group_create(text, text, text, text, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_category_group_create(text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_group_create(text, text, text, text, integer, boolean) TO service_role;

-- -----------------------------------------------------------------------------
-- accounting_category_group_update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_category_group_update(
  p_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_sort_order integer DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_archived boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_category_groups%ROWTYPE;
  v_new public.accounting_category_groups%ROWTYPE;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  ) THEN
    RAISE EXCEPTION
      'accounting_category_group_update: permesso manage_settings o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_category_group_update: utente autenticato richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_category_groups
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_category_group_update: gruppo % non trovato', p_id;
  END IF;

  -- Soft-archive
  IF p_archived IS TRUE THEN
    IF v_old.is_system IS TRUE THEN
      RAISE EXCEPTION
        'accounting_category_group_update: soft-archive vietato su gruppo di sistema';
    END IF;
  END IF;

  -- Non disattivare se QUOTE attiva nel gruppo
  IF p_is_active IS FALSE AND EXISTS (
    SELECT 1 FROM public.accounting_categories c
    WHERE c.group_id = p_id AND upper(c.code) = 'QUOTE' AND c.is_active
  ) THEN
    RAISE EXCEPTION
      'accounting_category_group_update: gruppo con QUOTE attiva non disattivabile';
  END IF;

  UPDATE public.accounting_category_groups
  SET
    name = COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''), name),
    description = CASE
      WHEN p_description IS NULL THEN description
      ELSE NULLIF(btrim(p_description), '')
    END,
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = COALESCE(p_is_active, is_active),
    archived_at = CASE
      WHEN p_archived IS TRUE THEN COALESCE(archived_at, now())
      WHEN p_archived IS FALSE THEN NULL
      ELSE archived_at
    END,
    archived_by = CASE
      WHEN p_archived IS TRUE THEN COALESCE(archived_by, v_uid)
      WHEN p_archived IS FALSE THEN NULL
      ELSE archived_by
    END,
    updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_category_groups',
    p_id,
    'category_group_updated',
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

COMMENT ON FUNCTION public.accounting_category_group_update(uuid, text, text, integer, boolean, boolean) IS
  'Aggiorna campi sicuri gruppo. Non muta code/direction. manage_settings.';

REVOKE ALL ON FUNCTION public.accounting_category_group_update(uuid, text, text, integer, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_group_update(uuid, text, text, integer, boolean, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_category_group_update(uuid, text, text, integer, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_group_update(uuid, text, text, integer, boolean, boolean) TO service_role;

-- -----------------------------------------------------------------------------
-- accounting_category_create
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_category_create(
  p_group_id uuid,
  p_code text,
  p_name text,
  p_notes text DEFAULT NULL,
  p_default_nature text DEFAULT 'to_classify',
  p_include_in_commercial_limit boolean DEFAULT false,
  p_available_in_movements boolean DEFAULT true,
  p_available_in_budget boolean DEFAULT true,
  p_available_in_reports boolean DEFAULT true,
  p_sort_order integer DEFAULT 0,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text;
  v_grp public.accounting_category_groups%ROWTYPE;
  v_id uuid;
  v_nature text := COALESCE(NULLIF(btrim(p_default_nature), ''), 'to_classify');
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  ) THEN
    RAISE EXCEPTION
      'accounting_category_create: permesso manage_settings o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_category_create: utente autenticato richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_group_id IS NULL THEN
    RAISE EXCEPTION 'accounting_category_create: p_group_id obbligatorio';
  END IF;

  SELECT * INTO v_grp
  FROM public.accounting_category_groups
  WHERE id = p_group_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_category_create: gruppo % non trovato', p_group_id;
  END IF;

  IF v_grp.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'accounting_category_create: gruppo archiviato';
  END IF;

  v_code := public.accounting_normalize_category_code(p_code);
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'accounting_category_create: code obbligatorio';
  END IF;

  IF v_code = 'QUOTE' THEN
    RAISE EXCEPTION 'accounting_category_create: code QUOTE riservato';
  END IF;

  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'accounting_category_create: name obbligatorio';
  END IF;

  IF v_nature NOT IN ('institutional', 'commercial', 'mixed', 'to_classify') THEN
    RAISE EXCEPTION
      'accounting_category_create: default_nature non valido (%)', v_nature;
  END IF;

  INSERT INTO public.accounting_categories (
    group_id, code, name, direction, default_nature,
    include_in_commercial_limit, is_system, is_active, recommended_active,
    sort_order, notes,
    available_in_movements, available_in_budget, available_in_reports,
    created_by, updated_by
  ) VALUES (
    p_group_id, v_code, btrim(p_name), v_grp.direction, v_nature,
    COALESCE(p_include_in_commercial_limit, false),
    false,
    COALESCE(p_is_active, true),
    COALESCE(p_is_active, true),
    COALESCE(p_sort_order, 0),
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    COALESCE(p_available_in_movements, true),
    COALESCE(p_available_in_budget, true),
    COALESCE(p_available_in_reports, true),
    v_uid, v_uid
  )
  RETURNING id INTO v_id;

  PERFORM public.accounting_audit_write(
    'accounting_categories',
    v_id,
    'category_created',
    NULL,
    jsonb_build_object(
      'code', v_code,
      'group_id', p_group_id,
      'direction', v_grp.direction
    ),
    NULL,
    'ui',
    NULL,
    NULL
  );

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_category_create(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, integer, boolean
) IS
  'Crea categoria custom sotto gruppo. direction da gruppo. is_system=false.';

REVOKE ALL ON FUNCTION public.accounting_category_create(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, integer, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_create(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, integer, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_category_create(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, integer, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_create(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, integer, boolean
) TO service_role;

-- -----------------------------------------------------------------------------
-- accounting_category_update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_category_update(
  p_id uuid,
  p_name text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_default_nature text DEFAULT NULL,
  p_include_in_commercial_limit boolean DEFAULT NULL,
  p_available_in_movements boolean DEFAULT NULL,
  p_available_in_budget boolean DEFAULT NULL,
  p_available_in_reports boolean DEFAULT NULL,
  p_sort_order integer DEFAULT NULL,
  p_is_active boolean DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_archived boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.accounting_categories%ROWTYPE;
  v_new public.accounting_categories%ROWTYPE;
  v_nature text;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  ) THEN
    RAISE EXCEPTION
      'accounting_category_update: permesso manage_settings o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_category_update: utente autenticato richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_old
  FROM public.accounting_categories
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_category_update: categoria % non trovata', p_id;
  END IF;

  IF upper(v_old.code) = 'QUOTE' AND p_is_active IS FALSE THEN
    RAISE EXCEPTION 'accounting_category_update: QUOTE non disattivabile';
  END IF;

  IF p_default_nature IS NOT NULL THEN
    v_nature := btrim(p_default_nature);
    IF v_nature NOT IN ('institutional', 'commercial', 'mixed', 'to_classify') THEN
      RAISE EXCEPTION
        'accounting_category_update: default_nature non valido (%)', v_nature;
    END IF;
  END IF;

  UPDATE public.accounting_categories
  SET
    name = COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''), name),
    notes = CASE
      WHEN p_notes IS NULL THEN notes
      ELSE NULLIF(btrim(p_notes), '')
    END,
    default_nature = COALESCE(v_nature, default_nature),
    include_in_commercial_limit = COALESCE(
      p_include_in_commercial_limit, include_in_commercial_limit
    ),
    available_in_movements = COALESCE(p_available_in_movements, available_in_movements),
    available_in_budget = COALESCE(p_available_in_budget, available_in_budget),
    available_in_reports = COALESCE(p_available_in_reports, available_in_reports),
    sort_order = COALESCE(p_sort_order, sort_order),
    is_active = CASE
      WHEN upper(code) = 'QUOTE' THEN true
      ELSE COALESCE(p_is_active, is_active)
    END,
    group_id = COALESCE(p_group_id, group_id),
    archived_at = CASE
      WHEN p_archived IS TRUE THEN COALESCE(archived_at, now())
      WHEN p_archived IS FALSE THEN NULL
      ELSE archived_at
    END,
    archived_by = CASE
      WHEN p_archived IS TRUE THEN COALESCE(archived_by, v_uid)
      WHEN p_archived IS FALSE THEN NULL
      ELSE archived_by
    END,
    updated_by = v_uid
  WHERE id = p_id
  RETURNING * INTO v_new;

  PERFORM public.accounting_audit_write(
    'accounting_categories',
    p_id,
    'category_updated',
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

COMMENT ON FUNCTION public.accounting_category_update(
  uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, uuid, boolean
) IS
  'Aggiorna campi sicuri categoria. Non muta code/direction/is_system. manage_settings.';

REVOKE ALL ON FUNCTION public.accounting_category_update(
  uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, uuid, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_category_update(
  uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, uuid, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_category_update(
  uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, uuid, boolean
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_category_update(
  uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, uuid, boolean
) TO service_role;

-- -----------------------------------------------------------------------------
-- accounting_recommended_activation_reset
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_recommended_activation_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_corr uuid := gen_random_uuid();
  v_cats int := 0;
  v_groups int := 0;
BEGIN
  IF NOT (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  ) THEN
    RAISE EXCEPTION
      'accounting_recommended_activation_reset: permesso manage_settings o Admin richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION
      'accounting_recommended_activation_reset: utente autenticato richiesto'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.accounting_categories
  SET
    is_active = CASE
      WHEN upper(code) = 'QUOTE' THEN true
      ELSE recommended_active
    END,
    updated_by = v_uid
  WHERE archived_at IS NULL;

  GET DIAGNOSTICS v_cats = ROW_COUNT;

  UPDATE public.accounting_category_groups g
  SET
    is_active = EXISTS (
      SELECT 1
      FROM public.accounting_categories c
      WHERE c.group_id = g.id
        AND c.is_active IS TRUE
        AND c.archived_at IS NULL
    ),
    updated_by = v_uid
  WHERE g.archived_at IS NULL;

  GET DIAGNOSTICS v_groups = ROW_COUNT;

  -- QUOTE_SPORT sempre attivo se QUOTE esiste
  UPDATE public.accounting_category_groups g
  SET is_active = true,
      updated_by = v_uid
  WHERE EXISTS (
    SELECT 1 FROM public.accounting_categories c
    WHERE c.group_id = g.id AND upper(c.code) = 'QUOTE' AND c.is_active
  );

  PERFORM public.accounting_audit_write(
    'accounting_categories',
    (
      SELECT id FROM public.accounting_categories
      WHERE upper(code) = 'QUOTE'
      LIMIT 1
    ),
    'categories_recommended_reset',
    NULL,
    jsonb_build_object(
      'categories_touched', v_cats,
      'groups_touched', v_groups
    ),
    NULL,
    'ui',
    v_corr,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'categories_updated', v_cats,
    'groups_updated', v_groups,
    'correlation_id', v_corr
  );
END;
$$;

COMMENT ON FUNCTION public.accounting_recommended_activation_reset() IS
  'Ripristina is_active = recommended_active (QUOTE sempre true). Sync gruppi.';

REVOKE ALL ON FUNCTION public.accounting_recommended_activation_reset() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_recommended_activation_reset() FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_recommended_activation_reset() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_recommended_activation_reset() TO service_role;

-- =============================================================================
-- 9) RLS / GRANT
-- =============================================================================
REVOKE ALL ON TABLE public.accounting_category_groups FROM anon;
REVOKE ALL ON TABLE public.accounting_category_groups FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_category_groups FROM authenticated;

REVOKE ALL ON TABLE public.accounting_categories FROM anon;
REVOKE ALL ON TABLE public.accounting_categories FROM PUBLIC;
REVOKE ALL ON TABLE public.accounting_categories FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_category_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.accounting_categories TO authenticated;
-- Nessun GRANT DELETE su groups/categories

GRANT ALL ON TABLE public.accounting_category_groups TO service_role;
GRANT ALL ON TABLE public.accounting_categories TO service_role;

ALTER TABLE public.accounting_category_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;

-- --- groups ---
DROP POLICY IF EXISTS accounting_category_groups_select
  ON public.accounting_category_groups;
CREATE POLICY accounting_category_groups_select
  ON public.accounting_category_groups
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.view')
  );

DROP POLICY IF EXISTS accounting_category_groups_insert
  ON public.accounting_category_groups;
CREATE POLICY accounting_category_groups_insert
  ON public.accounting_category_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

DROP POLICY IF EXISTS accounting_category_groups_update
  ON public.accounting_category_groups;
CREATE POLICY accounting_category_groups_update
  ON public.accounting_category_groups
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  )
  WITH CHECK (
    public.is_app_admin()
    OR public.has_accounting_permission('accounting.manage_settings')
  );

-- Nessuna policy DELETE su groups.

-- --- categories (riafferma pattern 010 + manage_settings) ---
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

-- Nessuna policy DELETE su categories (archive via UPDATE archived_at).

-- Ricarica schema PostgREST (tabelle/colonne nuove per API)
NOTIFY pgrst, 'reload schema';

COMMIT;
