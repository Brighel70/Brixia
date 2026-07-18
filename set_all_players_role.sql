-- ========================================
-- IMPOSTA RUOLO "GIOCATORE" PER TUTTI I GIOCATORI
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase
-- Questo script imposta il ruolo "Giocatore" (app_role) per tutte le persone
-- che hanno is_player = true

-- 1. Verifica quale ruolo esiste (Giocatore o Player)
DO $$
DECLARE
  giocatore_role_id uuid;
  updated_count integer;
BEGIN
  -- Cerca il ruolo "Giocatore" o "Player" nella tabella user_roles
  SELECT id INTO giocatore_role_id
  FROM public.user_roles
  WHERE LOWER(name) IN ('giocatore', 'player')
  LIMIT 1;

  -- Se il ruolo non esiste, lo crea
  IF giocatore_role_id IS NULL THEN
    INSERT INTO public.user_roles (name, position_order)
    VALUES ('Giocatore', 99)
    RETURNING id INTO giocatore_role_id;
    
    RAISE NOTICE '✅ Ruolo "Giocatore" creato con ID: %', giocatore_role_id;
  ELSE
    RAISE NOTICE '✅ Ruolo trovato con ID: %', giocatore_role_id;
  END IF;

  -- 2. Prima pulisci eventuali valori testuali (convertili in UUID)
  -- Se ci sono record con app_role = 'giocatore' o 'player' come testo, convertili
  UPDATE public.people
  SET app_role = giocatore_role_id::text
  WHERE is_player = true
    AND app_role IS NOT NULL 
    AND app_role != ''
    AND app_role !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND LOWER(app_role) IN ('giocatore', 'player');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count > 0 THEN
    RAISE NOTICE '✅ % persone con ruolo testuale convertite', updated_count;
  END IF;

  -- 3. Aggiorna tutte le persone con is_player = true che non hanno già un app_role
  UPDATE public.people
  SET app_role = giocatore_role_id::text
  WHERE is_player = true
    AND (app_role IS NULL OR app_role = '');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ % persone aggiornate con ruolo Giocatore', updated_count;

  -- 4. Se vuoi aggiornare TUTTE le persone giocatrici (anche quelle con ruolo già impostato),
  -- decommenta queste righe e commenta gli UPDATE sopra:
  /*
  UPDATE public.people
  SET app_role = giocatore_role_id::text
  WHERE is_player = true;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ % persone aggiornate con ruolo Giocatore (incluse quelle con ruolo già esistente)', updated_count;
  */

END $$;

-- 5. Verifica il risultato
SELECT 
  'Persone aggiornate' as info,
  COUNT(*) as totale,
  COUNT(CASE WHEN app_role IS NOT NULL THEN 1 END) as con_ruolo_giocatore
FROM public.people
WHERE is_player = true;

-- 6. Mostra un campione delle persone aggiornate
SELECT 
  p.given_name || ' ' || p.family_name as nome_completo,
  p.fiscal_code,
  p.is_player,
  COALESCE(ur.name, p.app_role, '❌ Senza ruolo') as ruolo_app,
  CASE 
    WHEN p.app_role IS NOT NULL AND p.app_role != '' 
         AND p.app_role ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN '✅ Ha ruolo (UUID)'
    WHEN p.app_role IS NOT NULL AND p.app_role != '' 
    THEN '⚠️ Ha ruolo (testo: ' || p.app_role || ')'
    ELSE '❌ Senza ruolo'
  END as status
FROM public.people p
LEFT JOIN public.user_roles ur ON 
  (p.app_role ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND p.app_role::uuid = ur.id)
  OR (p.app_role !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND LOWER(p.app_role) = LOWER(ur.name))
WHERE p.is_player = true
ORDER BY ruolo_app NULLS LAST, nome_completo
LIMIT 20;

-- 7. Statistiche finali
SELECT 
  'STATISTICHE FINALI' as categoria,
  COUNT(*) FILTER (WHERE is_player = true) as totale_giocatori,
  COUNT(*) FILTER (WHERE is_player = true AND app_role IS NOT NULL) as giocatori_con_ruolo,
  COUNT(*) FILTER (WHERE is_player = true AND app_role IS NULL) as giocatori_senza_ruolo
FROM public.people;

