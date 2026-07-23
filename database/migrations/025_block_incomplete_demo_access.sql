-- =============================================================================
-- 025_block_incomplete_demo_access.sql
-- =============================================================================
-- Una persona senza codice di accesso non deve risultare abilitata per errore.
-- Questa migration non elimina persone, ruoli, profili o dati: blocca soltanto
-- gli accessi TeamFlow/FlowMe incompleti. Un accesso torna attivo dalla scheda
-- persona quando vengono impostati ruolo e relativo codice.
-- =============================================================================

BEGIN;

UPDATE public.people
SET teamflow_access_blocked = true
WHERE COALESCE(teamflow_access_blocked, false) = false
  AND teamflow_app_role IS NOT NULL
  AND NULLIF(btrim(invite_code_teamflow), '') IS NULL;

UPDATE public.people
SET flowme_access_blocked = true
WHERE COALESCE(flowme_access_blocked, false) = false
  AND app_role IS NOT NULL
  AND NULLIF(btrim(invite_code), '') IS NULL;

COMMIT;
