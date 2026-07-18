-- =====================================================
-- FIX TABELLA INJURIES - CONTROLLA E AGGIORNA STRUTTURA
-- =====================================================

-- 1. Prima controlliamo la struttura esistente della tabella
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'injuries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Controlliamo se la colonna duration_days esiste
DO $$
BEGIN
    -- Se la colonna duration_days non esiste, la aggiungiamo
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'injuries' 
        AND column_name = 'duration_days'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.injuries ADD COLUMN duration_days INTEGER;
        RAISE NOTICE 'Colonna duration_days aggiunta alla tabella injuries';
    ELSE
        RAISE NOTICE 'Colonna duration_days già esistente';
    END IF;
    
    -- Se la colonna stop_prediction_days esiste, la rinominiamo
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'injuries' 
        AND column_name = 'stop_prediction_days'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.injuries RENAME COLUMN stop_prediction_days TO duration_days;
        RAISE NOTICE 'Colonna stop_prediction_days rinominata in duration_days';
    END IF;
END $$;

-- 3. Controlliamo se la colonna current_status esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'injuries' 
        AND column_name = 'current_status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.injuries ADD COLUMN current_status TEXT DEFAULT 'In corso';
        RAISE NOTICE 'Colonna current_status aggiunta alla tabella injuries';
    ELSE
        RAISE NOTICE 'Colonna current_status già esistente';
    END IF;
END $$;

-- 4. Controlliamo se la colonna description esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'injuries' 
        AND column_name = 'description'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.injuries ADD COLUMN description TEXT;
        RAISE NOTICE 'Colonna description aggiunta alla tabella injuries';
    ELSE
        RAISE NOTICE 'Colonna description già esistente';
    END IF;
END $$;

-- 5. Aggiorniamo i record esistenti che potrebbero avere current_status NULL
UPDATE public.injuries 
SET current_status = 'In corso' 
WHERE current_status IS NULL;

-- 6. Verifichiamo la struttura finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'injuries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Testiamo la vista con la struttura corretta
CREATE OR REPLACE VIEW active_injuries AS
SELECT 
    i.id,
    i.person_id,
    i.injury_date,
    i.duration_days,
    i.current_status,
    i.description,
    i.created_at,
    i.updated_at,
    p.full_name,
    p.given_name,
    p.family_name,
    -- Calcola giorni rimanenti
    GREATEST(0, (i.injury_date + INTERVAL '1 day' * i.duration_days)::DATE - CURRENT_DATE) as days_remaining,
    -- Calcola data fine infortunio
    (i.injury_date + INTERVAL '1 day' * i.duration_days)::DATE as end_date
FROM public.injuries i
JOIN public.people p ON p.id = i.person_id
WHERE i.current_status = 'In corso'
ORDER BY i.injury_date DESC;

-- 8. Test della vista
SELECT 
    full_name,
    injury_date,
    duration_days,
    current_status,
    days_remaining,
    end_date
FROM active_injuries
LIMIT 5;

-- 9. Se ci sono record senza duration_days, inseriamo un valore di default
UPDATE public.injuries 
SET duration_days = 7 
WHERE duration_days IS NULL;

-- 10. Verifica finale
SELECT 
    'Tabella injuries aggiornata con successo' as status,
    COUNT(*) as total_injuries,
    COUNT(*) FILTER (WHERE current_status = 'In corso') as active_injuries,
    COUNT(*) FILTER (WHERE current_status = 'Guarito') as healed_injuries
FROM public.injuries;











