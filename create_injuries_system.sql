-- =====================================================
-- SISTEMA COMPLETO PER GESTIONE INFORTUNI
-- =====================================================
-- Questo script crea la tabella injuries e imposta il sistema
-- per gestire gli infortuni di TUTTI i giocatori

-- 1. Crea la tabella injuries se non esiste
CREATE TABLE IF NOT EXISTS public.injuries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    injury_date DATE NOT NULL,
    duration_days INTEGER NOT NULL,
    current_status TEXT NOT NULL DEFAULT 'In corso',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crea l'indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_injuries_person_status 
ON public.injuries(person_id, current_status);

CREATE INDEX IF NOT EXISTS idx_injuries_status 
ON public.injuries(current_status);

-- 3. Aggiungi il trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_injuries_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_injuries_updated_at ON public.injuries;
CREATE TRIGGER set_injuries_updated_at
    BEFORE UPDATE ON public.injuries
    FOR EACH ROW
    EXECUTE FUNCTION update_injuries_updated_at_column();

-- 4. Funzione per chiudere automaticamente infortuni scaduti
CREATE OR REPLACE FUNCTION close_expired_injuries()
RETURNS INTEGER AS $$
DECLARE
    closed_count INTEGER;
BEGIN
    UPDATE public.injuries 
    SET 
        current_status = 'Guarito',
        updated_at = NOW()
    WHERE 
        current_status = 'In corso'
        AND injury_date + INTERVAL '1 day' * duration_days < CURRENT_DATE;
    
    GET DIAGNOSTICS closed_count = ROW_COUNT;
    
    RETURN closed_count;
END;
$$ language 'plpgsql';

-- 5. Crea una vista per infortuni attivi (facilita le query)
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

-- 6. Funzione helper per verificare se un giocatore è infortunato
CREATE OR REPLACE FUNCTION is_player_injured(player_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.injuries 
        WHERE person_id = player_uuid 
        AND current_status = 'In corso'
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
    ORDER BY injury_date DESC
    LIMIT 1;
    
    RETURN COALESCE(days_remaining, 0);
END;
$$ language 'plpgsql';

-- 8. Inserisci alcuni infortuni di test per diversi giocatori
-- (Solo se esistono giocatori nella tabella people)

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
        -- Inserisci infortuni di test per i primi 3 giocatori
        FOR test_players IN 
            SELECT id, full_name 
            FROM people 
            WHERE is_player = true 
            ORDER BY full_name 
            LIMIT 3
        LOOP
            -- Inserisci un infortunio di test (infortunato 3 giorni fa, durata 7 giorni)
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
            ON CONFLICT DO NOTHING; -- Evita duplicati se lo script viene eseguito più volte
            
            RAISE NOTICE 'Infortunio di test creato per: %', test_players.full_name;
        END LOOP;
        
        RAISE NOTICE 'Creati % infortuni di test', LEAST(3, player_count);
    ELSE
        RAISE NOTICE 'Nessun giocatore trovato. Crea prima alcuni giocatori per testare il sistema infortuni.';
    END IF;
END $$;

-- 9. Verifica la creazione della tabella e dei dati
SELECT 
    'Tabella injuries creata con successo' as status,
    COUNT(*) as total_injuries,
    COUNT(*) FILTER (WHERE current_status = 'In corso') as active_injuries,
    COUNT(*) FILTER (WHERE current_status = 'Guarito') as healed_injuries
FROM public.injuries;

-- 10. Mostra gli infortuni attivi (se ce ne sono)
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

-- 11. Test delle funzioni helper
SELECT 
    p.full_name,
    is_player_injured(p.id) as is_injured,
    get_injury_days_remaining(p.id) as days_remaining
FROM public.people p
WHERE p.is_player = true
ORDER BY p.full_name
LIMIT 10;

-- =====================================================
-- ISTRUZIONI PER L'UTILIZZO:
-- =====================================================
-- 1. Esegui questo script completo nel Supabase SQL Editor
-- 2. Il sistema creerà automaticamente la tabella e le funzioni
-- 3. Verrà inserito un infortunio di test per i primi 3 giocatori
-- 4. Ora puoi gestire gli infortuni direttamente dall'interfaccia
-- 5. Per chiudere manualmente infortuni scaduti: SELECT close_expired_injuries();
-- 6. Per vedere tutti gli infortuni attivi: SELECT * FROM active_injuries;
-- =====================================================











