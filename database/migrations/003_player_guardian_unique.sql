-- MIGRAZIONE 003: Unique constraint anti-duplicati su player_guardian_relationships
-- Impedisce coppie duplicate (player_person_id, guardian_person_id)
-- Idempotente: esegui in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.player_guardian_relationships'::regclass
      AND conname = 'player_guardian_relationships_unique_pair'
  ) THEN
    ALTER TABLE public.player_guardian_relationships
    ADD CONSTRAINT player_guardian_relationships_unique_pair
    UNIQUE (player_person_id, guardian_person_id);
    RAISE NOTICE 'Constraint player_guardian_relationships_unique_pair aggiunto.';
  ELSE
    RAISE NOTICE 'Constraint player_guardian_relationships_unique_pair già presente.';
  END IF;
END $$;
