-- ═══════════════════════════════════════════════════════════════════════════════
-- Ordine corretto: 1) DROP FK su people3  2) UPDATE colonne  3) ADD FK su people
-- ═══════════════════════════════════════════════════════════════════════════════
-- Le 7 tabelle/colonne: documents.created_by, guardians.(child|guardian)_person_id,
-- medical_certificates.person_id, person_consents.(person_id|signed_by_person_id), players.person_id
--
-- DOPO: esegui database/drop_people3_safe.sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── STEP 1: Salva info FK e DROP tutte le FK che puntano a people3 ───

DO $$
DECLARE
  r RECORD;
  tbl regclass;
  new_name text;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _fk_to_people3 (
    table_name text,
    column_name text,
    del_rule text,
    upd_rule text,
    new_constraint_name text
  );
  TRUNCATE _fk_to_people3;

  FOR r IN
    SELECT
      c.conrelid AS table_oid,
      c.conname AS constraint_name,
      a.attname AS column_name,
      c.confdeltype,
      c.confupdtype
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.people3'::regclass
  LOOP
    new_name := r.constraint_name;
    IF new_name LIKE '%people3%' THEN
      new_name := regexp_replace(new_name, 'people3', 'people', 'g');
    ELSE
      new_name := r.constraint_name || '_people';
    END IF;

    INSERT INTO _fk_to_people3 (table_name, column_name, del_rule, upd_rule, new_constraint_name)
    VALUES (
      (r.table_oid::regclass)::text,
      r.column_name,
      CASE r.confdeltype WHEN 'c' THEN ' CASCADE' WHEN 'n' THEN ' SET NULL' WHEN 'r' THEN ' RESTRICT' WHEN 'd' THEN ' SET DEFAULT' ELSE ' RESTRICT' END,
      CASE r.confupdtype WHEN 'c' THEN ' CASCADE' WHEN 'n' THEN ' SET NULL' WHEN 'r' THEN ' RESTRICT' WHEN 'd' THEN ' SET DEFAULT' ELSE ' RESTRICT' END,
      new_name
    );

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', (r.table_oid::regclass)::text, r.constraint_name);
    RAISE NOTICE 'Dropped FK % on %.%', r.constraint_name, (r.table_oid::regclass)::text, r.column_name;
  END LOOP;
END $$;

-- ─── STEP 2: Aggiorna colonne (valori people3_id → people_id dove serve) ───

UPDATE public.documents d
SET created_by = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = d.created_by),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = d.created_by OR p.id = d.created_by LIMIT 1),
  d.created_by
)
WHERE d.created_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = d.created_by);

UPDATE public.guardians g
SET child_person_id = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = g.child_person_id),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = g.child_person_id OR p.id = g.child_person_id LIMIT 1),
  g.child_person_id
)
WHERE g.child_person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = g.child_person_id);

UPDATE public.guardians g
SET guardian_person_id = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = g.guardian_person_id),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = g.guardian_person_id OR p.id = g.guardian_person_id LIMIT 1),
  g.guardian_person_id
)
WHERE g.guardian_person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = g.guardian_person_id);

UPDATE public.medical_certificates mc
SET person_id = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = mc.person_id),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = mc.person_id OR p.id = mc.person_id LIMIT 1),
  mc.person_id
)
WHERE mc.person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = mc.person_id);

UPDATE public.person_consents pc
SET person_id = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = pc.person_id),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = pc.person_id OR p.id = pc.person_id LIMIT 1),
  pc.person_id
)
WHERE pc.person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = pc.person_id);

UPDATE public.person_consents pc
SET signed_by_person_id = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = pc.signed_by_person_id),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = pc.signed_by_person_id OR p.id = pc.signed_by_person_id LIMIT 1),
  pc.signed_by_person_id
)
WHERE pc.signed_by_person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = pc.signed_by_person_id);

UPDATE public.players pl
SET person_id = COALESCE(
  (SELECT m.people_id FROM public.people3_people_map m WHERE m.people3_id = pl.person_id),
  (SELECT p.id FROM public.people p WHERE p.legacy_people3_id = pl.person_id OR p.id = pl.person_id LIMIT 1),
  pl.person_id
)
WHERE pl.person_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.people p2 WHERE p2.id = pl.person_id);

-- ─── STEP 2.5: Riferimenti orfani (id non in people) → NULL o DELETE ───
-- Nessuna copia da people3: le persone fake in people3 non vanno in people.
-- Colonne nullable: SET NULL. players: righe orfane eliminate (person_id di test).
UPDATE public.documents SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = documents.created_by);
UPDATE public.guardians SET child_person_id = NULL WHERE child_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = guardians.child_person_id);
UPDATE public.guardians SET guardian_person_id = NULL WHERE guardian_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = guardians.guardian_person_id);
UPDATE public.medical_certificates SET person_id = NULL WHERE person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = medical_certificates.person_id);
UPDATE public.person_consents SET person_id = NULL WHERE person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_consents.person_id);
UPDATE public.person_consents SET signed_by_person_id = NULL WHERE signed_by_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = person_consents.signed_by_person_id);
-- players: righe che puntano a persone non in people (fake/test) → eliminate
DELETE FROM public.players WHERE person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = players.person_id);

-- ─── STEP 3: Aggiungi le FK verso people(id) usando i dati salvati ───

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT table_name, column_name, del_rule, upd_rule, new_constraint_name FROM _fk_to_people3
  LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.people(id) ON DELETE%s ON UPDATE%s',
      r.table_name, r.new_constraint_name, r.column_name, r.del_rule, r.upd_rule
    );
    RAISE NOTICE 'Added FK % on %.% → people(id)', r.new_constraint_name, r.table_name, r.column_name;
  END LOOP;
  DROP TABLE _fk_to_people3;
END $$;
