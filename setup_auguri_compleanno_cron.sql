-- ============================================================
-- AUGURI COMPLEANNO AUTOMATICI - Solo Supabase, nessun cron esterno
-- ============================================================
-- Esegui questo script in Supabase → SQL Editor
-- Gli auguri vengono inviati ogni giorno alle 10:00 (ora italiana)

-- 1. Abilita le estensioni necessarie (se non già attive)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Funzione che inserisce le notifiche auguri per i compleanni di oggi
CREATE OR REPLACE FUNCTION public.send_birthday_wishes_today()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  msg TEXT;
  first_name TEXT;
  profile_id UUID;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.given_name, p.family_name, p.date_of_birth
    FROM people p
    WHERE p.date_of_birth IS NOT NULL
      AND EXTRACT(MONTH FROM p.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY FROM p.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
  LOOP
    first_name := COALESCE(TRIM(r.given_name), SPLIT_PART(TRIM(COALESCE(r.full_name, '')), ' ', 1), '');
    IF first_name = '' THEN
      first_name := COALESCE(r.full_name, '');
    END IF;

    msg := E'🏉🎉 Ehi ' || first_name || E'! Oggi si festeggia forte! 🎂🥳

Tantissimi auguri da tutta la famiglia Brixia Rugby! 💙
Che il tuo compleanno sia pieno di sorrisi, energia ed entusiasmo,
e ricco di mete nella tua vita! 💪🔥

Goditi la giornata come dopo una grande vittoria 💥

Un abbraccio enorme,
Brixia Rugby 🏉💙';

    SELECT pr.id INTO profile_id
    FROM profiles pr
    WHERE pr.person_id = r.id
    LIMIT 1;

    -- Inserisci sempre: user_id se c'è profilo, person_id per utenti invite (FlowMe)
    INSERT INTO notifications (user_id, person_id, title, body, type, metadata)
    VALUES (
      profile_id,
      r.id,
      'Auguri di compleanno! 🎂',
      msg,
      'birthday_wishes',
      jsonb_build_object('person_id', r.id)
    );
  END LOOP;
END;
$$;

-- 3. Schedula l'esecuzione ogni giorno alle 9:00 UTC (= 10:00 Italia in inverno)
--    In estate (ora legale) sarà alle 11:00 Italia. Per 10:00 anche in estate usa '0 8 * * *'
SELECT cron.schedule(
  'auguri-compleanno-10am',
  '0 9 * * *',
  'SELECT send_birthday_wishes_today()'
);

-- Per verificare che il job sia stato creato:
-- SELECT * FROM cron.job WHERE jobname = 'auguri-compleanno-10am';

-- Per disattivare: SELECT cron.unschedule('auguri-compleanno-10am');
