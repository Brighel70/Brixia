-- Codice invito separato per TeamFlow (invite_code resta per Flowme)
-- Esegui in Supabase → SQL Editor

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS invite_code_teamflow TEXT;

-- Unicità: ogni codice può essere usato una sola volta (per Flowme e per TeamFlow)
CREATE UNIQUE INDEX IF NOT EXISTS idx_people_invite_code_teamflow
  ON public.people(invite_code_teamflow)
  WHERE invite_code_teamflow IS NOT NULL AND invite_code_teamflow != '';

COMMENT ON COLUMN public.people.invite_code_teamflow IS 'Codice invito per registrazione alla webapp TeamFlow (separato da invite_code usato per Flowme)';
