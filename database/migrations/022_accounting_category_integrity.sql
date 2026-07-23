-- =============================================================================
-- 022_accounting_category_integrity.sql
-- =============================================================================
-- Correzioni additive post 019: integrita categorie, QUOTE, movimenti e budget.
--
-- NON APPLICARE automaticamente. Questa migration non elimina dati e non modifica
-- le migration 010-021. Eseguire solo dopo backup e verifica dei test 022.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Canonicalizzazione sicura di SPONSOR
-- -----------------------------------------------------------------------------
-- Se il vecchio codice SPONSORIZZAZIONI esiste, lo storico resta agganciato alla
-- sua riga. Viene creata la categoria canonica SPONSOR e la voce legacy viene
-- resa non selezionabile per nuovi inserimenti: nessuna FK viene riscritta.
INSERT INTO public.accounting_categories (
  code, name, direction, default_nature, include_in_commercial_limit,
  is_system, is_active, recommended_active, sort_order, notes,
  group_id, available_in_movements, available_in_budget, available_in_reports
)
SELECT
  'SPONSOR',
  'Sponsorizzazioni e proventi commerciali',
  'income',
  'commercial',
  true,
  true,
  true,
  true,
  20,
  'Categoria di sistema canonica per documenti commerciali e incassi sponsor.',
  public.accounting_category_group_id_by_code('income', 'SPONSOR_PUB'),
  true,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_categories WHERE upper(btrim(code)) = 'SPONSOR'
);

UPDATE public.accounting_categories
SET
  is_active = false,
  available_in_movements = false,
  available_in_budget = false,
  available_in_reports = false,
  notes = concat_ws(
    E'\n',
    notes,
    'Codice legacy: mantenuto solo per lo storico. Usare SPONSOR per i nuovi inserimenti.'
  )
WHERE upper(btrim(code)) = 'SPONSORIZZAZIONI'
  AND EXISTS (
    SELECT 1 FROM public.accounting_categories canonical
    WHERE upper(btrim(canonical.code)) = 'SPONSOR'
  );

CREATE OR REPLACE FUNCTION public.accounting_commercial_preferred_income_category_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT c.id
  FROM public.accounting_categories c
  WHERE upper(btrim(c.code)) = 'SPONSOR'
    AND c.direction = 'income'
    AND c.is_active IS TRUE
    AND c.archived_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.accounting_commercial_preferred_income_category_id() IS
  'Restituisce esclusivamente la categoria canonica SPONSOR attiva per i nuovi incassi commerciali.';

REVOKE ALL ON FUNCTION public.accounting_commercial_preferred_income_category_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_commercial_preferred_income_category_id() FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_preferred_income_category_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_commercial_preferred_income_category_id() TO service_role;

-- -----------------------------------------------------------------------------
-- 2) Guardie DB: codice, QUOTE, categorie e macro-categorie
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_categories_integrity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));

  IF NEW.code = '' OR NEW.code !~ '^[A-Z0-9]+(_[A-Z0-9]+)*$' THEN
    RAISE EXCEPTION
      'accounting_categories_integrity_guard: codice categoria non valido (%)', NEW.code;
  END IF;

  -- Il codice legacy non puo' piu' essere creato o reintrodotto.
  IF TG_OP = 'INSERT' AND NEW.code IN ('QUOTE', 'SPONSORIZZAZIONI') THEN
    RAISE EXCEPTION
      'accounting_categories_integrity_guard: categoria % riservata al flusso di sistema', NEW.code;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_system IS TRUE
     AND NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION
      'accounting_categories_integrity_guard: categoria di sistema non archiviabile (%)', OLD.code;
  END IF;

  IF NEW.code = 'QUOTE' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.code <> 'QUOTE') THEN
      RAISE EXCEPTION
        'accounting_categories_integrity_guard: QUOTE e'' riservata alla sincronizzazione FlowMe';
    END IF;
    IF NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'accounting_categories_integrity_guard: QUOTE non archiviabile';
    END IF;

    -- QUOTE resta utilizzabile soltanto dal flusso fee_sync; il report continua
    -- a mostrare lo storico e gli incassi automatici gia' contabilizzati.
    NEW.is_system := true;
    NEW.is_active := true;
    NEW.direction := 'income';
    NEW.default_nature := 'institutional';
    NEW.include_in_commercial_limit := false;
    NEW.available_in_movements := false;
    NEW.available_in_budget := false;
    NEW.available_in_reports := true;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.archived_at IS NOT NULL THEN
    NEW.is_active := false;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_system IS TRUE
     AND NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION
      'accounting_categories_integrity_guard: gruppo immutabile su categoria di sistema (%)', OLD.code;
  END IF;

  IF NEW.group_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR TG_OP = 'UPDATE' AND NEW.group_id IS DISTINCT FROM OLD.group_id
     )
     AND EXISTS (
       SELECT 1
       FROM public.accounting_category_groups g
       WHERE g.id = NEW.group_id AND g.archived_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION
      'accounting_categories_integrity_guard: non e'' possibile assegnare una categoria a una macro archiviata';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_categories_integrity_guard ON public.accounting_categories;
CREATE TRIGGER trg_accounting_categories_integrity_guard
  BEFORE INSERT OR UPDATE ON public.accounting_categories
  FOR EACH ROW EXECUTE FUNCTION public.accounting_categories_integrity_guard();

CREATE OR REPLACE FUNCTION public.accounting_categories_prevent_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION
    'accounting_categories_prevent_delete: DELETE fisico vietato; usare l''archiviazione logica quando consentita';
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_categories_prevent_delete ON public.accounting_categories;
CREATE TRIGGER trg_accounting_categories_prevent_delete
  BEFORE DELETE ON public.accounting_categories
  FOR EACH ROW EXECUTE FUNCTION public.accounting_categories_prevent_delete();

CREATE OR REPLACE FUNCTION public.accounting_category_groups_integrity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  IF NEW.code = '' OR NEW.code !~ '^[A-Z0-9]+(_[A-Z0-9]+)*$' THEN
    RAISE EXCEPTION
      'accounting_category_groups_integrity_guard: codice macro-categoria non valido (%)', NEW.code;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_system IS TRUE
     AND NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION
      'accounting_category_groups_integrity_guard: macro-categoria di sistema non archiviabile (%)', OLD.code;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.direction IS DISTINCT FROM OLD.direction
     AND EXISTS (
       SELECT 1 FROM public.accounting_categories c WHERE c.group_id = OLD.id
     ) THEN
    RAISE EXCEPTION
      'accounting_category_groups_integrity_guard: direction non modificabile con sottocategorie collegate';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
     AND EXISTS (
       SELECT 1
       FROM public.accounting_categories c
       WHERE c.group_id = OLD.id
         AND c.archived_at IS NULL
         AND c.is_active IS TRUE
     ) THEN
    RAISE EXCEPTION
      'accounting_category_groups_integrity_guard: archiviare prima o disattivare le sottocategorie attive';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.archived_at IS NOT NULL THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_category_groups_integrity_guard
  ON public.accounting_category_groups;
CREATE TRIGGER trg_accounting_category_groups_integrity_guard
  BEFORE INSERT OR UPDATE ON public.accounting_category_groups
  FOR EACH ROW EXECUTE FUNCTION public.accounting_category_groups_integrity_guard();

CREATE OR REPLACE FUNCTION public.accounting_category_groups_prevent_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION
    'accounting_category_groups_prevent_delete: DELETE fisico vietato; usare l''archiviazione logica quando consentita';
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_category_groups_prevent_delete
  ON public.accounting_category_groups;
CREATE TRIGGER trg_accounting_category_groups_prevent_delete
  BEFORE DELETE ON public.accounting_category_groups
  FOR EACH ROW EXECUTE FUNCTION public.accounting_category_groups_prevent_delete();

-- -----------------------------------------------------------------------------
-- 3) Prima nota e Preventivo: validazione anche fuori dalla UI
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accounting_manual_movement_category_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_category public.accounting_categories%ROWTYPE;
BEGIN
  -- Non rendere non modificabili movimenti storici la cui categoria e' stata
  -- disattivata/archiviata dopo la creazione: controlla solo nuove scelte.
  IF NEW.origin <> 'manual' OR (
    TG_OP = 'UPDATE'
    AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id
    AND NEW.direction IS NOT DISTINCT FROM OLD.direction
    AND NEW.origin IS NOT DISTINCT FROM OLD.origin
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_category
  FROM public.accounting_categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_manual_movement_category_guard: categoria non trovata';
  END IF;
  IF upper(v_category.code) = 'QUOTE' THEN
    RAISE EXCEPTION 'accounting_manual_movement_category_guard: QUOTE e'' riservata alla sincronizzazione FlowMe';
  END IF;
  IF v_category.archived_at IS NOT NULL OR v_category.is_active IS NOT TRUE
     OR v_category.available_in_movements IS NOT TRUE THEN
    RAISE EXCEPTION
      'accounting_manual_movement_category_guard: categoria non disponibile per nuovi movimenti manuali';
  END IF;
  IF v_category.direction <> 'both' AND v_category.direction <> NEW.direction THEN
    RAISE EXCEPTION
      'accounting_manual_movement_category_guard: direction movimento/categoria incompatibile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_manual_movement_category_guard
  ON public.accounting_movements;
CREATE TRIGGER trg_accounting_manual_movement_category_guard
  BEFORE INSERT OR UPDATE OF category_id, direction, origin ON public.accounting_movements
  FOR EACH ROW EXECUTE FUNCTION public.accounting_manual_movement_category_guard();

CREATE OR REPLACE FUNCTION public.accounting_budget_line_category_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_category public.accounting_categories%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id
     AND NEW.direction IS NOT DISTINCT FROM OLD.direction THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_category
  FROM public.accounting_categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'accounting_budget_line_category_guard: categoria non trovata';
  END IF;
  IF upper(v_category.code) = 'QUOTE' THEN
    RAISE EXCEPTION 'accounting_budget_line_category_guard: QUOTE e'' automatica e non utilizzabile nel Preventivo';
  END IF;
  IF v_category.archived_at IS NOT NULL OR v_category.is_active IS NOT TRUE
     OR v_category.available_in_budget IS NOT TRUE THEN
    RAISE EXCEPTION
      'accounting_budget_line_category_guard: categoria non disponibile per nuove righe di Preventivo';
  END IF;
  IF v_category.direction <> 'both' AND v_category.direction <> NEW.direction THEN
    RAISE EXCEPTION
      'accounting_budget_line_category_guard: direction riga/categoria incompatibile';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounting_budget_line_category_guard
  ON public.accounting_budget_lines;
CREATE TRIGGER trg_accounting_budget_line_category_guard
  BEFORE INSERT OR UPDATE OF category_id, direction ON public.accounting_budget_lines
  FOR EACH ROW EXECUTE FUNCTION public.accounting_budget_line_category_guard();

-- -----------------------------------------------------------------------------
-- 4) Nessun bypass diretto delle RPC di configurazione
-- -----------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON TABLE public.accounting_category_groups FROM authenticated;
REVOKE INSERT, UPDATE ON TABLE public.accounting_categories FROM authenticated;

DROP POLICY IF EXISTS accounting_category_groups_insert ON public.accounting_category_groups;
DROP POLICY IF EXISTS accounting_category_groups_update ON public.accounting_category_groups;
DROP POLICY IF EXISTS accounting_categories_insert ON public.accounting_categories;
DROP POLICY IF EXISTS accounting_categories_update ON public.accounting_categories;

-- Corregge i valori operativi storicamente introdotti da 019: QUOTE resta
-- visibile nel Consuntivo ma non e' disponibile per Prima nota/Preventivo.
UPDATE public.accounting_categories
SET
  is_active = true,
  is_system = true,
  available_in_movements = false,
  available_in_budget = false,
  available_in_reports = true
WHERE upper(btrim(code)) = 'QUOTE';

COMMENT ON COLUMN public.accounting_categories.available_in_reports IS
  'Controlla l''utilizzo in nuove configurazioni/report; non nasconde mai lo storico contabilizzato.';

NOTIFY pgrst, 'reload schema';

COMMIT;
