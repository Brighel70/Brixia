-- =============================================================================
-- MIGRAZIONE 002: player_guardian_relationships people3 → people
-- =============================================================================
-- Sposta le FK da people3 a people.
-- Prerequisito: 001_people3_to_people_bridge.sql eseguito, people3_people_map popolato.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Verifica prerequisiti e esegui migrazione
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people3_people_map') THEN
    RAISE EXCEPTION 'Prerequisito mancante: esegui prima 001_people3_to_people_bridge.sql';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'player_guardian_relationships') THEN
    RAISE NOTICE 'Tabella player_guardian_relationships non esiste. Skip.';
    RETURN;
  END IF;

  -- 2. Rimuovi FK esistenti verso people3
  ALTER TABLE public.player_guardian_relationships 
    DROP CONSTRAINT IF EXISTS player_guardian_relationships_player_person_id_fkey;
  ALTER TABLE public.player_guardian_relationships 
    DROP CONSTRAINT IF EXISTS player_guardian_relationships_guardian_person_id_fkey;

  FOR r IN 
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'public.player_guardian_relationships'::regclass AND contype = 'f'
      AND (pg_get_constraintdef(oid) LIKE '%people3%' OR confrelid = 'public.people3'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE public.player_guardian_relationships DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  -- 3. Aggiorna player_person_id e guardian_person_id con people.id
  UPDATE public.player_guardian_relationships pgr
  SET 
    player_person_id = COALESCE(
      (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = pgr.player_person_id LIMIT 1),
      (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = pgr.player_person_id OR p.id = pgr.player_person_id LIMIT 1),
      pgr.player_person_id
    ),
    guardian_person_id = COALESCE(
      (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = pgr.guardian_person_id LIMIT 1),
      (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = pgr.guardian_person_id OR p.id = pgr.guardian_person_id LIMIT 1),
      pgr.guardian_person_id
    );

  -- 4. Rimuovi righe orfane
  DELETE FROM public.player_guardian_relationships
  WHERE NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = player_person_id)
     OR NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = guardian_person_id);

  -- 5. Aggiungi FK verso people (se non già presenti)
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.player_guardian_relationships'::regclass AND conname = 'player_guardian_relationships_player_person_id_fkey') THEN
    ALTER TABLE public.player_guardian_relationships
      ADD CONSTRAINT player_guardian_relationships_player_person_id_fkey
      FOREIGN KEY (player_person_id) REFERENCES public.people(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.player_guardian_relationships'::regclass AND conname = 'player_guardian_relationships_guardian_person_id_fkey') THEN
    ALTER TABLE public.player_guardian_relationships
      ADD CONSTRAINT player_guardian_relationships_guardian_person_id_fkey
      FOREIGN KEY (guardian_person_id) REFERENCES public.people(id) ON DELETE CASCADE;
  END IF;

  RAISE NOTICE 'Migrazione 002 completata. player_guardian_relationships ora punta a people.';
END $$;
