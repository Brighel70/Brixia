-- ========================================
-- SCRIPT PER CORREGGERE IL CAMPO is_minor
-- Aggiorna is_minor basandosi sulla data di nascita
-- ========================================

-- 1. Mostra la situazione prima della correzione
SELECT 'SITUAZIONE PRIMA DELLA CORREZIONE:' as info;
SELECT 
    COUNT(*) as totale,
    COUNT(CASE WHEN is_minor = true THEN 1 END) as minorenni_prima,
    COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as minorenni_reali
FROM public.people 
WHERE date_of_birth IS NOT NULL;

-- 2. Aggiorna il campo is_minor basandosi sulla data di nascita
UPDATE public.people 
SET 
    is_minor = (EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18),
    updated_at = now()
WHERE date_of_birth IS NOT NULL;

-- 3. Mostra la situazione dopo la correzione
SELECT 'SITUAZIONE DOPO LA CORREZIONE:' as info;
SELECT 
    COUNT(*) as totale,
    COUNT(CASE WHEN is_minor = true THEN 1 END) as minorenni_dopo,
    COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as minorenni_reali
FROM public.people 
WHERE date_of_birth IS NOT NULL;

-- 4. Mostra alcuni esempi di minorenni corretti
SELECT 'ESEMPI MINORENNI CORRETTI:' as info;
SELECT 
    id,
    full_name,
    date_of_birth,
    is_minor,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) as eta
FROM public.people 
WHERE is_minor = true
ORDER BY date_of_birth DESC
LIMIT 10;

-- 5. Verifica che non ci siano più errori
SELECT 'VERIFICA FINALE - ERRORI RIMANENTI:' as info;
SELECT 
    COUNT(CASE WHEN is_minor = true AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18 THEN 1 END) as errori_minori_falsi,
    COUNT(CASE WHEN is_minor = false AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as errori_maggiorenni_falsi
FROM public.people 
WHERE date_of_birth IS NOT NULL;
