-- Verifica 025: non rimangono accessi abilitati senza il proprio codice.
SELECT
  'T1_incomplete_accesses_blocked' AS check_id,
  NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE COALESCE(teamflow_access_blocked, false) = false
      AND teamflow_app_role IS NOT NULL
      AND NULLIF(btrim(invite_code_teamflow), '') IS NULL
  ) AS teamflow_ok,
  NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE COALESCE(flowme_access_blocked, false) = false
      AND app_role IS NOT NULL
      AND NULLIF(btrim(invite_code), '') IS NULL
  ) AS flowme_ok;
