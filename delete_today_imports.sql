-- ========================================
-- CANCELLA RECORD IMPORTATI OGGI
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase
-- ATTENZIONE: Questo script elimina tutti i record della tabella people
-- che sono stati creati oggi (data odierna)

-- 1. PRIMA: Visualizza quali record verranno eliminati (per sicurezza)
SELECT 
  'RECORD CHE VERRANNO ELIMINATI' as info,
  COUNT(*) as totale_record,
  MIN(created_at) as primo_record,
  MAX(created_at) as ultimo_record
FROM public.people
WHERE DATE(created_at) = CURRENT_DATE;

-- 2. Visualizza un campione dei record che verranno eliminati
SELECT 
  id,
  given_name,
  family_name,
  fiscal_code,
  is_player,
  created_at
FROM public.people
WHERE DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 20;

-- 3. OPZIONE A: Elimina SOLO i record importati oggi (RECOMMENDED)
-- Decommenta queste righe per eseguire l'eliminazione:
/*
BEGIN;

DELETE FROM public.people
WHERE DATE(created_at) = CURRENT_DATE;

-- Verifica quante righe sono state eliminate
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RAISE NOTICE '✅ % record eliminati', deleted_count;

COMMIT;
*/

-- 4. OPZIONE B: Elimina tutti i record importati oggi CON codice fiscale (più sicuro)
-- Se vuoi essere più sicuro, elimina solo quelli con codice fiscale (probabilmente importati da Excel)
/*
BEGIN;

DELETE FROM public.people
WHERE DATE(created_at) = CURRENT_DATE
  AND fiscal_code IS NOT NULL
  AND fiscal_code != '';

-- Verifica quante righe sono state eliminate
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RAISE NOTICE '✅ % record con codice fiscale eliminati', deleted_count;

COMMIT;
*/

-- 5. OPZIONE C: Elimina solo i record giocatori importati oggi (più sicuro ancora)
-- Elimina solo quelli con is_player = true e creati oggi
/*
BEGIN;

DELETE FROM public.people
WHERE DATE(created_at) = CURRENT_DATE
  AND is_player = true
  AND fiscal_code IS NOT NULL
  AND fiscal_code != '';

-- Verifica quante righe sono state eliminate
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RAISE NOTICE '✅ % giocatori eliminati', deleted_count;

COMMIT;
*/

-- NOTA: Se i record sono stati creati in un'altra data (non oggi),
-- modifica CURRENT_DATE con la data specifica, ad esempio:
-- WHERE DATE(created_at) = '2025-01-29'  -- Sostituisci con la data corretta

-- 6. DOPO L'ELIMINAZIONE: Verifica che non ci siano più record di oggi
SELECT 
  'VERIFICA FINALE' as info,
  COUNT(*) as record_rimanenti_oggi
FROM public.people
WHERE DATE(created_at) = CURRENT_DATE;

