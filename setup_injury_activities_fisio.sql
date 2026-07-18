-- =============================================================================
-- SETUP injury_activities: tutti i campi usati da Fisioterapia e Planning
-- Esegui questo script nel SQL Editor di Supabase se mancano colonne.
-- =============================================================================

-- 1) activity_description (NOT NULL) - se la tabella ha "description" invece di "activity_description"
--    la tabella create_injuries_tables.sql ha già activity_description NOT NULL.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'activity_description'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN activity_description text;
        UPDATE public.injury_activities SET activity_description = description WHERE activity_description IS NULL;
        ALTER TABLE public.injury_activities ALTER COLUMN activity_description SET NOT NULL;
        COMMENT ON COLUMN public.injury_activities.activity_description IS 'Descrizione dell''attività (obbligatoria)';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'activity_description'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN activity_description text NOT NULL DEFAULT 'Attività';
        COMMENT ON COLUMN public.injury_activities.activity_description IS 'Descrizione dell''attività (obbligatoria)';
    END IF;
END $$;

-- 2) ricontrollo (data prossima seduta / ricontrollo)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'ricontrollo'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN ricontrollo DATE;
        COMMENT ON COLUMN public.injury_activities.ricontrollo IS 'Data di ricontrollo / prossima fisioterapia';
    END IF;
END $$;

-- 3) ricontrollo_time (orario prossima seduta)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'ricontrollo_time'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN ricontrollo_time TIME;
        COMMENT ON COLUMN public.injury_activities.ricontrollo_time IS 'Orario della prossima seduta (fisioterapia) o del ricontrollo';
    END IF;
END $$;

-- 4) duration_minutes (già in create_injuries_tables; aggiungi solo se manca)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'duration_minutes'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN duration_minutes integer;
        COMMENT ON COLUMN public.injury_activities.duration_minutes IS 'Durata in minuti (tempo di intervento fisioterapia)';
    END IF;
END $$;

-- 5) massaggio, tecar, laser (tipo fisioterapia)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'massaggio') THEN
        ALTER TABLE public.injury_activities ADD COLUMN massaggio boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.massaggio IS 'Trattamento Massaggio';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'tecar') THEN
        ALTER TABLE public.injury_activities ADD COLUMN tecar boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.tecar IS 'Trattamento Tecar';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'laser') THEN
        ALTER TABLE public.injury_activities ADD COLUMN laser boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.laser IS 'Trattamento Laser';
    END IF;
END $$;

-- 6) can_play_field, can_play_gym, expected_stop_days (visite mediche / autorizzazioni)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'can_play_field') THEN
        ALTER TABLE public.injury_activities ADD COLUMN can_play_field boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.can_play_field IS 'Autorizzato a giocare in campo';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'can_play_gym') THEN
        ALTER TABLE public.injury_activities ADD COLUMN can_play_gym boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.can_play_gym IS 'Autorizzato ad allenarsi in palestra';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'expected_stop_days') THEN
        ALTER TABLE public.injury_activities ADD COLUMN expected_stop_days integer;
        COMMENT ON COLUMN public.injury_activities.expected_stop_days IS 'Previsione giorni di stop';
    END IF;
END $$;

-- Verifica colonne presenti
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'injury_activities'
ORDER BY ordinal_position;
