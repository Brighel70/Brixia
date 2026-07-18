-- =============================================================================
-- Regole di NON-accavallamento per injury_activities
-- Buffer fisso 4 minuti, overlap detection, vincoli giocatore/medico/macchinari
-- Eseguire su Supabase SQL Editor (stesso DB di FlowMe)
-- =============================================================================

-- 1) Aggiungi colonne se mancano
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'buffer_minuti') THEN
    ALTER TABLE public.injury_activities ADD COLUMN buffer_minuti integer DEFAULT 4;
    COMMENT ON COLUMN public.injury_activities.buffer_minuti IS 'Minuti di buffer dopo la durata (sempre 4)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = 'override_overlap') THEN
    ALTER TABLE public.injury_activities ADD COLUMN override_overlap boolean DEFAULT false;
    COMMENT ON COLUMN public.injury_activities.override_overlap IS 'Se true: override confermato per sovrapposizione fisio stesso operatore';
  END IF;
END $$;

-- 2) Funzione helper: calcola start_ts e end_ts per una riga
CREATE OR REPLACE FUNCTION injury_activity_slot_ts(
  p_date date,
  p_time time,
  p_duration_min integer,
  p_buffer_min integer DEFAULT 4
) RETURNS TABLE (start_ts timestamptz, end_ts timestamptz) AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_dur integer;
  v_buf integer;
BEGIN
  IF p_date IS NULL OR p_time IS NULL THEN
    RETURN;
  END IF;
  v_dur := COALESCE(NULLIF(p_duration_min, 0), 30);
  v_buf := COALESCE(NULLIF(p_buffer_min, 0), 4);
  v_start := (p_date::text || ' ' || p_time::text)::timestamp AT TIME ZONE 'Europe/Rome';
  v_end := v_start + (v_dur + v_buf) * interval '1 minute';
  RETURN QUERY SELECT v_start, v_end;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3) Funzione di validazione overlap (chiamata dal trigger)
CREATE OR REPLACE FUNCTION check_injury_activity_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_date date;
  v_time time;
  v_duration integer;
  v_buffer integer;
  v_new_start timestamptz;
  v_new_end timestamptz;
  v_person_id uuid;
  v_activity_type text;
  v_operator text;
  v_tecar boolean;
  v_laser boolean;
  v_exclude_id uuid;
  rec record;
  v_ex_start timestamptz;
  v_ex_end timestamptz;
  v_ex_person_id uuid;
  v_ex_operator text;
  v_ex_tecar boolean;
  v_ex_laser boolean;
  v_ex_act_type text;
BEGIN
  v_exclude_id := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END;

  -- Determina date/time effective (FlowMe: activity_date+activity_time, AppBrixia: ricontrollo+ricontrollo_time)
  -- Usa ::date per evitare che colonne timestamptz producano "2026-02-22 00:00:00+00" e timestamp invalido
  v_date := (COALESCE(NEW.ricontrollo, NEW.activity_date))::date;
  v_time := COALESCE(NEW.ricontrollo_time, NEW.activity_time);

  -- Solo per attività con orario (visite mediche e fisioterapia)
  IF v_date IS NULL OR v_time IS NULL THEN
    RETURN NEW;
  END IF;

  v_duration := COALESCE(NULLIF(NEW.duration_minutes, 0), 30);
  v_buffer := COALESCE(NULLIF(NEW.buffer_minuti, 0), 4);
  v_new_start := (v_date::text || ' ' || v_time::text)::timestamp AT TIME ZONE 'Europe/Rome';
  v_new_end := v_new_start + (v_duration + v_buffer) * interval '1 minute';

  SELECT i.person_id INTO v_person_id FROM injuries i WHERE i.id = NEW.injury_id;
  v_activity_type := COALESCE(NEW.activity_type, '');
  v_operator := NULLIF(TRIM(NEW.operator_name), '');
  v_tecar := COALESCE(NEW.tecar, false);
  v_laser := COALESCE(NEW.laser, false);

  -- Cerca attività sovrapposte nello stesso giorno (con orario)
  FOR rec IN
    SELECT
      ia.id,
      ia.injury_id,
      ia.operator_name,
      ia.activity_type,
      ia.tecar,
      ia.laser,
      ia.ricontrollo,
      ia.activity_date,
      ia.ricontrollo_time,
      ia.activity_time,
      ia.duration_minutes,
      ia.buffer_minuti,
      i.person_id
    FROM injury_activities ia
    JOIN injuries i ON i.id = ia.injury_id
    WHERE (ia.id IS DISTINCT FROM v_exclude_id)
      AND (COALESCE(ia.ricontrollo, ia.activity_date) = v_date)
      AND (ia.ricontrollo_time IS NOT NULL OR ia.activity_time IS NOT NULL)
  LOOP
    -- ::date evita timestamp invalido se activity_date/ricontrollo sono timestamptz (es. "2026-02-22 00:00:00+00 17:15:00")
    v_ex_start := (
      (COALESCE(rec.ricontrollo, rec.activity_date))::date::text || ' ' ||
      COALESCE(rec.ricontrollo_time, rec.activity_time)::text
    )::timestamp AT TIME ZONE 'Europe/Rome';
    v_ex_end := v_ex_start + (COALESCE(NULLIF(rec.duration_minutes, 0), 30) + COALESCE(NULLIF(rec.buffer_minuti, 0), 4)) * interval '1 minute';

    -- Overlap: new_start < ex_end AND ex_start < new_end
    IF v_new_start < v_ex_end AND v_ex_start < v_new_end THEN
      v_ex_person_id := rec.person_id;
      v_ex_operator := NULLIF(TRIM(rec.operator_name), '');
      v_ex_tecar := COALESCE(rec.tecar, false);
      v_ex_laser := COALESCE(rec.laser, false);
      v_ex_act_type := COALESCE(rec.activity_type, '');

      -- A) STESSO GIOCATORE => BLOCCO HARD
      IF v_ex_person_id = v_person_id THEN
        RAISE EXCEPTION 'Impossibile salvare: il giocatore ha già un appuntamento nella fascia %-%',
          to_char(v_ex_start, 'HH24:MI'),
          to_char(v_ex_end - interval '1 minute', 'HH24:MI');
      END IF;

      -- D) MACCHINARI TECAR/LASER => BLOCCO HARD
      IF v_tecar AND v_ex_tecar THEN
        RAISE EXCEPTION 'Impossibile salvare: il macchinario TECAR è già occupato nella fascia %-%',
          to_char(v_ex_start, 'HH24:MI'),
          to_char(v_ex_end - interval '1 minute', 'HH24:MI');
      END IF;
      IF v_laser AND v_ex_laser THEN
        RAISE EXCEPTION 'Impossibile salvare: il macchinario LASER è già occupato nella fascia %-%',
          to_char(v_ex_start, 'HH24:MI'),
          to_char(v_ex_end - interval '1 minute', 'HH24:MI');
      END IF;

      -- B) VISITA MEDICA stesso medico => BLOCCO HARD
      IF (v_activity_type IN ('medical_visit', 'Visita medica') AND v_ex_act_type IN ('medical_visit', 'Visita medica'))
         AND v_operator IS NOT NULL AND v_ex_operator IS NOT NULL
         AND v_operator = v_ex_operator THEN
        RAISE EXCEPTION 'Impossibile salvare: il medico % ha già una visita nella fascia %-%',
          v_operator,
          to_char(v_ex_start, 'HH24:MI'),
          to_char(v_ex_end - interval '1 minute', 'HH24:MI');
      END IF;

      -- C) FISIOTERAPIA stesso operatore => WARNING (override solo se override_overlap=true)
      IF (v_activity_type IN ('physiotherapy', 'Fisioterapia') AND v_ex_act_type IN ('physiotherapy', 'Fisioterapia'))
         AND v_operator IS NOT NULL AND v_ex_operator IS NOT NULL
         AND v_operator = v_ex_operator THEN
        IF COALESCE(NEW.override_overlap, false) = false THEN
          RAISE EXCEPTION 'Attenzione: l''operatore % ha già un appuntamento nella fascia %-%. Conferma sovrapposizione per procedere.',
            v_operator,
            to_char(v_ex_start, 'HH24:MI'),
            to_char(v_ex_end - interval '1 minute', 'HH24:MI');
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_check_injury_activity_overlap ON injury_activities;
CREATE TRIGGER trg_check_injury_activity_overlap
  BEFORE INSERT OR UPDATE ON injury_activities
  FOR EACH ROW
  EXECUTE PROCEDURE check_injury_activity_overlap();
