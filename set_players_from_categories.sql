-- ========================================
-- SCRIPT PER IMPOSTARE is_player = true
-- per tutte le persone che hanno categorie assegnate
-- ========================================

-- 1. Verifica quante persone hanno categorie ma non sono marcate come giocatori
SELECT 'VERIFICA INIZIALE:' as info;
SELECT 
    COUNT(*) as persone_con_categorie_non_giocatori
FROM public.people 
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0 
  AND is_player = false;

-- 2. Mostra alcuni esempi di persone con categorie
SELECT 'ESEMPI PERSONE CON CATEGORIE:' as info;
SELECT 
    id,
    full_name,
    player_categories,
    is_player
FROM public.people 
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0
LIMIT 5;

-- 3. Aggiorna tutte le persone che hanno categorie impostando is_player = true
UPDATE public.people 
SET 
    is_player = true,
    updated_at = now()
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0
  AND is_player = false;

-- 4. Verifica il risultato
SELECT 'RISULTATO AGGIORNAMENTO:' as info;
SELECT 
    COUNT(*) as persone_aggiornate_a_giocatori
FROM public.people 
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0 
  AND is_player = true;

-- 5. Mostra statistiche finali
SELECT 'STATISTICHE FINALI:' as info;
SELECT 
    COUNT(*) as totale_persone,
    COUNT(CASE WHEN is_player = true THEN 1 END) as giocatori,
    COUNT(CASE WHEN player_categories IS NOT NULL AND jsonb_array_length(player_categories) > 0 THEN 1 END) as persone_con_categorie,
    COUNT(CASE WHEN is_player = true AND player_categories IS NOT NULL AND jsonb_array_length(player_categories) > 0 THEN 1 END) as giocatori_con_categorie
FROM public.people;

-- 6. Mostra alcuni esempi finali
SELECT 'ESEMPI FINALI:' as info;
SELECT 
    id,
    full_name,
    player_categories,
    is_player,
    CASE 
        WHEN player_categories IS NOT NULL AND jsonb_array_length(player_categories) > 0 THEN 'Ha categorie'
        ELSE 'Nessuna categoria'
    END as stato_categorie
FROM public.people 
WHERE is_player = true
LIMIT 10;
