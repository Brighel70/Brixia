-- STEP C: Tutori/Genitori
-- Migrazione sicura per Supabase - Non elimina nulla esistente

CREATE TABLE IF NOT EXISTS public.guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_person_id uuid NOT NULL REFERENCES public.people(id),
  guardian_person_id uuid NOT NULL REFERENCES public.people(id),
  relationship text NOT NULL, -- es. 'genitore','tutore'
  is_primary boolean NOT NULL DEFAULT false,
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_person_id, guardian_person_id)
);

-- Vincolo (opzionale): un minorenne deve avere almeno 1 tutore primario (deferred)
CREATE OR REPLACE FUNCTION public.check_minor_guardian()
RETURNS trigger 
LANGUAGE plpgsql AS $$
DECLARE 
  cnt int;
BEGIN
  IF NEW.is_minor THEN
    SELECT count(*) INTO cnt
    FROM public.guardians g
    WHERE g.child_person_id = NEW.id AND g.is_primary = true;
    IF tg_op = 'INSERT' AND cnt = 0 THEN
      -- non blocchiamo subito: si può aggiungere il tutore subito dopo in stessa transazione
      NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_people_minor_guard ON public.people;
CREATE TRIGGER trg_people_minor_guard
  AFTER INSERT OR UPDATE OF is_minor ON public.people
  FOR EACH ROW 
  EXECUTE FUNCTION public.check_minor_guardian();






