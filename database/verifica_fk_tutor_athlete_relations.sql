-- Verifica e correzione FK tutor_athlete_relations
-- Errore: "violates foreign key constraint tutor_athlete_relations_athlete_id_fkey"
-- athlete_id deve riferire people(id). Esegui in Supabase → SQL Editor.

-- 1. Verifica a quale tabella punta attualmente athlete_id (solo lettura)
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS tabella_riferita,
  ccu.column_name AS colonna_riferita
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'tutor_athlete_relations'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'athlete_id';

-- 2. Se la tabella_riferita non è 'people', rimuovi il vincolo e ricrealo su people(id)
ALTER TABLE public.tutor_athlete_relations
  DROP CONSTRAINT IF EXISTS tutor_athlete_relations_athlete_id_fkey;

ALTER TABLE public.tutor_athlete_relations
  ADD CONSTRAINT tutor_athlete_relations_athlete_id_fkey
  FOREIGN KEY (athlete_id) REFERENCES public.people(id) ON DELETE CASCADE;

-- 3. (Opzionale) Indice per performance
CREATE INDEX IF NOT EXISTS idx_tutor_athlete_relations_athlete_id
  ON public.tutor_athlete_relations(athlete_id);

-- 4. Verifica finale
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS tabella_riferita,
  ccu.column_name AS colonna_riferita
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'tutor_athlete_relations'
  AND tc.constraint_type = 'FOREIGN KEY';
