-- Script per aggiungere i nuovi campi alla tabella injury_activities
-- Esegui questo script nel SQL Editor di Supabase

-- Aggiungi il campo can_play_field (può giocare in campo)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'can_play_field'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN can_play_field boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.can_play_field IS 'Indica se il giocatore può tornare a giocare in campo';
    END IF;
END $$;

-- Aggiungi il campo can_play_gym (può allenarsi in palestra)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'can_play_gym'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN can_play_gym boolean DEFAULT false;
        COMMENT ON COLUMN public.injury_activities.can_play_gym IS 'Indica se il giocatore può allenarsi in palestra';
    END IF;
END $$;

-- Aggiungi il campo expected_stop_days (previsione stop in giorni)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'injury_activities'
        AND column_name = 'expected_stop_days'
    ) THEN
        ALTER TABLE public.injury_activities ADD COLUMN expected_stop_days integer;
        COMMENT ON COLUMN public.injury_activities.expected_stop_days IS 'Previsione giorni di stop (es. 1=1 giorno, 10=10 giorni, 14=2 settimane)';
    END IF;
END $$;

-- Verifica che i campi siano stati aggiunti correttamente
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'injury_activities'
AND column_name IN ('can_play_field', 'can_play_gym', 'expected_stop_days');
