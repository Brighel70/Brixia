-- ========================================
-- SCRIPT PER PULIRE LE CATEGORIE GIOCATORI
-- Rimuove gli UUID e mantiene solo i nomi delle categorie
-- ========================================

-- 1. Verifica il contenuto attuale delle categorie
SELECT 'VERIFICA CATEGORIE ATTUALE:' as info;
SELECT 
    id,
    full_name,
    player_categories
FROM public.people 
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0
LIMIT 5;

-- 2. Mostra le categorie disponibili per riferimento
SELECT 'CATEGORIE DISPONIBILI:' as info;
SELECT id, name, code FROM public.categories ORDER BY name;

-- 3. Pulisce le categorie mantenendo solo i nomi (non gli UUID)
UPDATE public.people 
SET 
    player_categories = (
        SELECT jsonb_agg(value)
        FROM jsonb_array_elements(player_categories)
        WHERE value::text !~ '^"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"$'  -- Esclude gli UUID
    ),
    updated_at = now()
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0;

-- 4. Verifica il risultato dopo la pulizia
SELECT 'RISULTATO DOPO PULIZIA:' as info;
SELECT 
    id,
    full_name,
    player_categories
FROM public.people 
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0
LIMIT 5;

-- 5. Conta quante persone hanno categorie pulite
SELECT 'STATISTICHE FINALI:' as info;
SELECT 
    COUNT(*) as persone_con_categorie_pulite
FROM public.people 
WHERE player_categories IS NOT NULL 
  AND jsonb_array_length(player_categories) > 0;
