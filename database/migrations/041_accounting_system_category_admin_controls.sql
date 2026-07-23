-- 041_accounting_system_category_admin_controls.sql
--
-- Admin e Super Admin possono configurare anche le categorie contabili di
-- sistema (compresa QUOTE): stato attivo e campi di configurazione. I codici,
-- la direzione, l'archiviazione e i vincoli dei flussi automatici restano
-- protetti: non sono impostazioni amministrative ma identificativi tecnici.

CREATE OR REPLACE FUNCTION public.accounting_category_enforce_group_coherence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_grp public.accounting_category_groups%ROWTYPE;
BEGIN
  IF upper(btrim(NEW.code)) = 'QUOTE' THEN
    NEW.is_system := true;
    NEW.direction := 'income';

    -- Per i normali utenti QUOTE mantiene i valori di sicurezza storici.
    -- Gli amministratori possono gestire stato e configurazione operativa.
    IF NOT public.is_app_admin() THEN
      NEW.is_active := true;
      NEW.default_nature := 'institutional';
      NEW.include_in_commercial_limit := false;
      IF TG_OP = 'UPDATE' AND NEW.is_active IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
          'accounting_category_enforce_group_coherence: QUOTE non disattivabile';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_system IS TRUE THEN
      IF NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION
          'accounting_category_enforce_group_coherence: code immutabile su categoria di sistema (%)',
          OLD.code;
      END IF;
      IF NEW.direction IS DISTINCT FROM OLD.direction THEN
        RAISE EXCEPTION
          'accounting_category_enforce_group_coherence: direction immutabile su categoria di sistema (%)',
          OLD.code;
      END IF;
    END IF;

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
        'accounting_category_enforce_group_coherence: group_id % non trovato', NEW.group_id;
    END IF;

    IF v_grp.archived_at IS NOT NULL AND TG_OP = 'INSERT' THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: gruppo archiviato (%), INSERT vietato', v_grp.code;
    END IF;

    IF NEW.direction IS DISTINCT FROM v_grp.direction THEN
      RAISE EXCEPTION
        'accounting_category_enforce_group_coherence: direction categoria (%) != gruppo (%)',
        NEW.direction, v_grp.direction;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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

    NEW.is_system := true;
    NEW.direction := 'income';

    -- Gli admin possono configurare QUOTE, ma non trasformarla in una categoria
    -- diversa o rimuoverla: i flussi quote/FlowMe la usano come identificativo.
    IF NOT public.is_app_admin() THEN
      NEW.is_active := true;
      NEW.default_nature := 'institutional';
      NEW.include_in_commercial_limit := false;
      NEW.available_in_movements := false;
      NEW.available_in_budget := false;
      NEW.available_in_reports := true;
    END IF;
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

  IF p_archived IS TRUE AND v_old.is_system IS TRUE THEN
    RAISE EXCEPTION
      'accounting_category_group_update: soft-archive vietato su gruppo di sistema';
  END IF;

  IF p_is_active IS FALSE
     AND NOT public.is_app_admin()
     AND EXISTS (
       SELECT 1
       FROM public.accounting_categories c
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
    'accounting_category_groups', p_id, 'category_group_updated',
    to_jsonb(v_old), to_jsonb(v_new), NULL, 'ui', NULL, NULL
  );

  RETURN p_id;
END;
$$;

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

  IF upper(v_old.code) = 'QUOTE'
     AND p_is_active IS FALSE
     AND NOT public.is_app_admin() THEN
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
      WHEN upper(code) = 'QUOTE' AND NOT public.is_app_admin() THEN true
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
    'accounting_categories', p_id, 'category_updated',
    to_jsonb(v_old), to_jsonb(v_new), NULL, 'ui', NULL, NULL
  );

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.accounting_category_update(
  uuid, text, text, text, boolean, boolean, boolean, boolean, integer, boolean, uuid, boolean
) IS
  'Aggiorna configurazione categoria. Admin e Super Admin possono intervenire anche sulle categorie di sistema; codice, direzione e archiviazione tecnica restano protetti.';

