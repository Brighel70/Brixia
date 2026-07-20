-- =============================================================================
-- 017_accounting_budget_approval_stamp.sql
-- =============================================================================
-- Patch incrementale Step 4A: solo stamp approvazione preventivo.
--
-- Contesto: 016 applicata parzialmente (tabelle + trigger QUOTE presenti;
--            trg_accounting_budgets_stamp_approval assente).
--
-- Compatibilità profiles.id ↔ auth.uid():
--   Confermata dal modello TeamFlow esistente:
--   - get_my_person_id() / is_app_admin() usano profiles WHERE id = auth.uid()
--   - ensure_support_admin e sync FlowMe inseriscono profiles.id = auth.users.id
--   Quindi approved_by = auth.uid() è valido per FK → profiles(id).
--
-- Questa migration:
--   - CREATE OR REPLACE accounting_budget_stamp_approval()
--   - DROP/CREATE SOLO del trigger di approval stamp
--   - NON modifica tabelle, righe, Quote, FlowMe, 010–016
--
-- NON APPLICARE senza revisione e approvazione.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.accounting_budget_stamp_approval()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Transizione draft → approved: forza timestamp e profilo autenticato.
  -- Qualsiasi approved_at/approved_by inviato dal client viene sovrascritto.
  IF OLD.status = 'draft' AND NEW.status = 'approved' THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION
        'accounting_budgets: approvazione richiede utente autenticato (auth.uid())'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = v_uid
    ) THEN
      RAISE EXCEPTION
        'accounting_budgets: approvazione richiede riga profiles.id = auth.uid()'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    NEW.approved_at := now();
    NEW.approved_by := v_uid;

  -- Bozza: approved_* devono restare NULL (impedisce falsificazione client).
  ELSIF NEW.status = 'draft' THEN
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;

  -- Qualsiasi altro cambio di status: conserva i valori già stampati dal server,
  -- ignora tentativi client di alterare approved_at/approved_by.
  ELSE
    NEW.approved_at := OLD.approved_at;
    NEW.approved_by := OLD.approved_by;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.accounting_budget_stamp_approval() IS
  'BEFORE UPDATE OF status su accounting_budgets: su draft→approved forza '
  'approved_at=now() e approved_by=auth.uid() (profiles.id). '
  'Il client non può scegliere né falsificare approved_at/approved_by.';

REVOKE ALL ON FUNCTION public.accounting_budget_stamp_approval() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accounting_budget_stamp_approval() FROM anon;
REVOKE ALL ON FUNCTION public.accounting_budget_stamp_approval() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_budget_stamp_approval() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accounting_budget_stamp_approval() TO service_role;

DROP TRIGGER IF EXISTS trg_accounting_budgets_stamp_approval
  ON public.accounting_budgets;

CREATE TRIGGER trg_accounting_budgets_stamp_approval
  BEFORE UPDATE OF status ON public.accounting_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.accounting_budget_stamp_approval();

COMMIT;

-- =============================================================================
-- TEST READ-ONLY (eseguibili subito dopo COMMIT; nessuna scrittura)
-- =============================================================================

-- T1 — funzione presente + search_path
SELECT
  'T1_fn_stamp_approval' AS check_id,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) LIKE '%search_path%' AS has_search_path_in_def,
  (
    SELECT string_agg(cfg, ',' ORDER BY cfg)
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
  ) AS proconfig,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
      WHERE cfg ILIKE 'search_path=pg_catalog, public'
         OR cfg ILIKE 'search_path=pg_catalog,public'
    ) THEN 'ok'
    ELSE 'fail_search_path'
  END AS search_path_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'accounting_budget_stamp_approval';

-- T2 — trigger presente su accounting_budgets, funzione collegata
SELECT
  'T2_trg_stamp_approval' AS check_id,
  t.tgname,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE WHEN t.tgenabled = 'D' THEN 'disabled' ELSE 'enabled' END AS state,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'accounting_budgets'
  AND t.tgname = 'trg_accounting_budgets_stamp_approval'
  AND NOT t.tgisinternal;

-- T3 — EXECUTE non concesso a anon/PUBLIC
SELECT
  'T3_fn_execute_grants' AS check_id,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'accounting_budget_stamp_approval'
  AND grantee IN ('anon', 'PUBLIC')
ORDER BY grantee;
-- Atteso: 0 righe

-- T4 — sintesi booleana
SELECT
  'T4_summary' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accounting_budget_stamp_approval'
  ) AS function_exists,
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'accounting_budgets'
      AND t.tgname = 'trg_accounting_budgets_stamp_approval'
      AND NOT t.tgisinternal
  ) AS approval_trigger_exists;

-- =============================================================================
-- TEST FUNZIONALE — SOLO DOCUMENTATO (NON ESEGUITO)
-- =============================================================================
-- Obiettivo: UPDATE draft → approved deve valorizzare approved_at/approved_by
--            con now()/auth.uid(), ignorando valori client spurî.
--
-- Prerequisiti:
--   - 017 applicata
--   - sessione autenticata con riga profiles.id = auth.uid()
--   - permesso accounting.post (o Admin)
--   - un accounting_budgets in status = 'draft'
--
-- Esempio (NON eseguire in questa migration; sostituire UUID):
--
-- UPDATE public.accounting_budgets
-- SET
--   status = 'approved',
--   approved_at = '2000-01-01 00:00:00+00',           -- tentativo falsificazione
--   approved_by = '00000000-0000-0000-0000-000000000000' -- tentativo falsificazione
-- WHERE id = '<BUDGET_DRAFT_UUID>'
--   AND status = 'draft'
-- RETURNING id, status, approved_at, approved_by;
--
-- Atteso:
--   status = 'approved'
--   approved_at ≈ now() (non 2000-01-01)
--   approved_by = auth.uid() (non lo zero-UUID)
-- =============================================================================
