-- =====================================================
-- ADATTAMENTO SISTEMA INJURIES AL DATABASE ESISTENTE
-- =====================================================
-- Questo script adatta il sistema infortuni alla struttura esistente

-- 1. Aggiungi la colonna duration_days se non esiste
DO $$
BEGIN
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
END $$;

-- 2. Aggiungi la colonna description se non esiste
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

-- 3. Aggiorna i record esistenti con valori di default per i campi obbligatori
UPDATE public.injuries 
SET 
    injury_type = COALESCE(injury_type, 'Generico'),
    severity = COALESCE(severity, 'Lieve'),
    body_part = COALESCE(body_part, 'Generale'),
    cause = COALESCE(cause, 'Non specificato'),
    duration_days = COALESCE(duration_days, COALESCE(expected_weeks_off * 7, 7)),
    description = COALESCE(description, 'Infortunio registrato dal sistema')
WHERE 
    injury_type IS NULL 
    OR severity IS NULL 
    OR body_part IS NULL 
    OR cause IS NULL 
    OR duration_days IS NULL;

-- 4. Crea una vista per infortuni attivi compatibile con il sistema
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
WHERE i.current_status = 'In corso' AND i.is_closed = false
ORDER BY i.injury_date DESC;

-- 5. Funzione per chiudere automaticamente infortuni scaduti
CREATE OR REPLACE FUNCTION close_expired_injuries()
RETURNS INTEGER AS $$
DECLARE
    closed_count INTEGER;
BEGIN
    UPDATE public.injuries 
    SET 
        current_status = 'Guarito',
        is_closed = true,
        injury_closed_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE 
        current_status = 'In corso' 
        AND is_closed = false
        AND injury_date + INTERVAL '1 day' * duration_days < CURRENT_DATE;
    
    GET DIAGNOSTICS closed_count = ROW_COUNT;
    
    RETURN closed_count;
END;
$$ language 'plpgsql';

-- 6. Funzione helper per verificare se un giocatore è infortunato
CREATE OR REPLACE FUNCTION is_player_injured(player_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.injuries 
        WHERE person_id = player_uuid 
        AND current_status = 'In corso' 
        AND is_closed = false
    );
END;
$$ language 'plpgsql';

-- 7. Funzione helper per ottenere i giorni rimanenti di un infortunio
CREATE OR REPLACE FUNCTION get_injury_days_remaining(player_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    days_remaining INTEGER;
BEGIN
    SELECT GREATEST(0, (injury_date + INTERVAL '1 day' * duration_days)::DATE - CURRENT_DATE)
    INTO days_remaining
    FROM public.injuries 
    WHERE person_id = player_uuid 
    AND current_status = 'In corso' 
    AND is_closed = false
    ORDER BY injury_date DESC
    LIMIT 1;
    
    RETURN COALESCE(days_remaining, 0);
END;
$$ language 'plpgsql';

-- 8. Inserisci alcuni infortuni di test per diversi giocatori
DO $$
DECLARE
    test_players RECORD;
    player_count INTEGER;
BEGIN
    -- Conta quanti giocatori ci sono
    SELECT COUNT(*) INTO player_count
    FROM people 
    WHERE is_player = true;
    
    -- Se ci sono giocatori, inserisci alcuni infortuni di test
    IF player_count > 0 THEN
        -- Inserisci infortuni di test per i primi 5 giocatori
        FOR test_players IN 
            SELECT id, full_name 
            FROM people 
            WHERE is_player = true 
            ORDER BY full_name 
            LIMIT 5
        LOOP
            -- Inserisci un infortunio di test
            INSERT INTO public.injuries (
                person_id, 
                injury_date, 
                injury_type,
                severity,
                body_part,
                cause,
                current_status,
                duration_days,
                description,
                is_closed
            ) VALUES (
                test_players.id,
                CURRENT_DATE - INTERVAL '3 days',
                'Distorsione',
                'Lieve',
                'Ginocchio',
                'Allenamento',
                'In corso',
                7,
                'Infortunio di test - ' || test_players.full_name,
                false
            )
            ON CONFLICT DO NOTHING; -- Evita duplicati
            
            RAISE NOTICE 'Infortunio di test creato per: %', test_players.full_name;
        END LOOP;
        
        RAISE NOTICE 'Creati % infortuni di test', LEAST(5, player_count);
    ELSE
        RAISE NOTICE 'Nessun giocatore trovato.';
    END IF;
END $$;

-- 9. Verifica la struttura finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'injuries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. Mostra gli infortuni attivi
SELECT 
    p.full_name,
    i.injury_date,
    i.duration_days,
    i.current_status,
    i.injury_type,
    i.severity,
    i.body_part,
    GREATEST(0, (i.injury_date + INTERVAL '1 day' * i.duration_days)::DATE - CURRENT_DATE) as giorni_rimanenti,
    (i.injury_date + INTERVAL '1 day' * i.duration_days)::DATE as data_fine_infortunio
FROM public.injuries i
JOIN public.people p ON p.id = i.person_id
WHERE i.current_status = 'In corso' AND i.is_closed = false
ORDER BY giorni_rimanenti ASC;

-- 11. Statistiche finali
SELECT 
    'Sistema infortuni adattato con successo' as status,
    COUNT(*) as total_injuries,
    COUNT(*) FILTER (WHERE current_status = 'In corso' AND is_closed = false) as active_injuries,
    COUNT(*) FILTER (WHERE current_status = 'Guarito') as healed_injuries
FROM public.injuries;

-- =====================================================
-- ISTRUZIONI PER L'UTILIZZO:
-- =====================================================
-- 1. Esegui questo script nel Supabase SQL Editor
-- 2. Il sistema adatterà la tabella esistente
-- 3. Verranno inseriti infortuni di test per 5 giocatori
-- 4. Ora il sistema funzionerà con la struttura esistente
-- 5. Per chiudere infortuni scaduti: SELECT close_expired_injuries();
-- 6. Per vedere infortuni attivi: SELECT * FROM active_injuries;
-- =====================================================











