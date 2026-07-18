-- DEPRECATED: usare people. Note su people3 sono legacy.
-- =============================================================================
-- VERIFICA SCHEMA DATABASE: tabelle e colonne usate da AppBrixia e FlowMe
-- Esegui nel SQL Editor di Supabase. Controlla che tutto sia presente.
-- =============================================================================

-- 1) Tabelle obbligatorie
DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
  t text;
  required_tables text[] := ARRAY[
    'activity_modification_notifications', 'attendance', 'categories', 'documents',
    'events', 'fee_assignments', 'fees', 'injuries', 'injury_activities',
    'match_lists', 'notes', 'notifications', 'people', 'profiles',
    'push_tokens', 'sessions', 'user_roles', 'training_locations'
  ];
BEGIN
  FOREACH t IN ARRAY required_tables
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      missing := array_append(missing, t);
    END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE NOTICE 'TABELLE MANCANTI: %', array_to_string(missing, ', ');
  ELSE
    RAISE NOTICE 'OK: Tutte le tabelle obbligatorie presenti.';
  END IF;
END $$;

-- 2) injury_activities: colonne per agenda, visite, fisio, overlap
SELECT 'injury_activities' AS tabella, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'injury_activities'
  AND column_name IN (
    'activity_date', 'ricontrollo', 'ricontrollo_time', 'activity_type', 'activity_description',
    'operator_name', 'duration_minutes', 'notes', 'confirmation_status',
    'massaggio', 'tecar', 'laser', 'can_play_field', 'can_play_gym',
    'buffer_minuti', 'override_overlap', 'injury_id'
  )
ORDER BY column_name;

-- Segnala colonne mancanti in injury_activities
DO $$
DECLARE
  required_ia text[] := ARRAY['activity_date','activity_type','activity_description','injury_id','ricontrollo','ricontrollo_time','notes','confirmation_status','buffer_minuti','override_overlap'];
  c text;
  missing text[] := ARRAY[]::text[];
BEGIN
  FOREACH c IN ARRAY required_ia
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'injury_activities' AND column_name = c) THEN
      missing := array_append(missing, c);
    END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE NOTICE 'injury_activities - COLONNE MANCANTI: %', array_to_string(missing, ', ');
  END IF;
END $$;

-- 3) activity_modification_notifications (per notifiche modifica appuntamento a FlowMe)
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_modification_notifications') AS activity_modification_notifications_esiste;

-- 4) notifications (per push/app mobile)
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') AS notifications_esiste;

-- 5) push_tokens (per FCM)
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_tokens') AS push_tokens_esiste;

-- 6) people: colonne per lista nera e anagrafica
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'people'
  AND column_name IN ('disqualified', 'disqualification_end_date', 'id', 'full_name', 'invite_code')
ORDER BY column_name;

-- 7) documents / notes: FK su person_id (nome vincolo)
-- Se person_id riferisce people3 ma l'app usa people.id, gli insert potrebbero fallire.
SELECT k.table_name, k.column_name, k.constraint_name
FROM information_schema.key_column_usage k
WHERE k.table_schema = 'public'
  AND k.table_name IN ('documents', 'notes')
  AND k.column_name = 'person_id';

-- 8) activity_modification_notifications (per notifiche modifica appuntamento a FlowMe)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'activity_modification_notifications'
ORDER BY ordinal_position;

-- 9) Nota: documents.created_by e notes.person_id nello schema di riferimento
--    puntano a people3(id). Se l'app usa la tabella people come anagrafica principale,
--    verifica che person_id/created_by siano coerenti (people vs people3).

-- 10) Riepilogo colonne injury_activities (tutte)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'injury_activities'
ORDER BY ordinal_position;
