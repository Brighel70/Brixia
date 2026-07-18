-- =====================================================
-- SCRIPT SEMPLIFICATO PER SISTEMA INJURIES
-- =====================================================
-- Questo script funziona con la struttura esistente della tabella

-- 1. Prima esegui fix_injuries_table.sql per correggere la struttura
-- 2. Poi esegui questo script

-- Verifica la struttura della tabella
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'injuries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Inserisci alcuni infortuni di test per diversi giocatori
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
                duration_days, 
                current_status, 
                description
            ) VALUES (
                test_players.id,
                CURRENT_DATE - INTERVAL '3 days',
                7,
                'In corso',
                'Infortunio di test - ' || test_players.full_name
            )
            ON CONFLICT DO NOTHING; -- Evita duplicati
            
            RAISE NOTICE 'Infortunio di test creato per: %', test_players.full_name;
        END LOOP;
        
        RAISE NOTICE 'Creati % infortuni di test', LEAST(5, player_count);
    ELSE
        RAISE NOTICE 'Nessun giocatore trovato.';
    END IF;
END $$;

-- Mostra gli infortuni attivi
SELECT 
    p.full_name,
    i.injury_date,
    i.duration_days,
    i.current_status,
    GREATEST(0, (i.injury_date + INTERVAL '1 day' * i.duration_days)::DATE - CURRENT_DATE) as giorni_rimanenti,
    (i.injury_date + INTERVAL '1 day' * i.duration_days)::DATE as data_fine_infortunio
FROM public.injuries i
JOIN public.people p ON p.id = i.person_id
WHERE i.current_status = 'In corso'
ORDER BY giorni_rimanenti ASC;

-- Statistiche finali
SELECT 
    'Sistema infortuni pronto' as status,
    COUNT(*) as total_injuries,
    COUNT(*) FILTER (WHERE current_status = 'In corso') as active_injuries
FROM public.injuries;











