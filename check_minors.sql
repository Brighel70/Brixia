-- ========================================
-- SCRIPT PER VERIFICARE I MINORENNI
-- Controlla se il campo is_minor è corretto
-- ========================================

-- 1. Conta i minorenni dal campo is_minor
SELECT 'MINORENNI DAL CAMPO is_minor:' as info;
SELECT 
    COUNT(*) as minorenni_da_campo,
    COUNT(CASE WHEN is_minor = true THEN 1 END) as is_minor_true,
    COUNT(CASE WHEN is_minor = false THEN 1 END) as is_minor_false,
    COUNT(CASE WHEN is_minor IS NULL THEN 1 END) as is_minor_null
FROM public.people;

-- 2. Calcola i minorenni dalla data di nascita (età < 18)
SELECT 'MINORENNI CALCOLATI DALLA DATA:' as info;
SELECT 
    COUNT(*) as minorenni_calcolati
FROM public.people 
WHERE date_of_birth IS NOT NULL 
  AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18;

-- 3. Mostra alcuni esempi di persone con date di nascita
SELECT 'ESEMPI PERSONE CON DATE DI NASCITA:' as info;
SELECT 
    id,
    full_name,
    date_of_birth,
    is_minor,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) as eta_calcolata
FROM public.people 
WHERE date_of_birth IS NOT NULL
ORDER BY date_of_birth DESC
LIMIT 10;

-- 4. Confronta is_minor con età calcolata
SELECT 'CONFRONTO is_minor vs ETA CALCOLATA:' as info;
SELECT 
    COUNT(*) as totale,
    COUNT(CASE WHEN is_minor = true AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as corretti_minori,
    COUNT(CASE WHEN is_minor = false AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18 THEN 1 END) as corretti_maggiorenni,
    COUNT(CASE WHEN is_minor = true AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18 THEN 1 END) as errori_minori_falsi,
    COUNT(CASE WHEN is_minor = false AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as errori_maggiorenni_falsi
FROM public.people 
WHERE date_of_birth IS NOT NULL;
