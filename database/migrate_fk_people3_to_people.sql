-- ═══════════════════════════════════════════════════════════════════════════════
-- Migra tutte le FK che puntano a people3 → people
-- ═══════════════════════════════════════════════════════════════════════════════
-- PRIMA: esegui database/inventory_fk_people_people3.sql (sezione 1) per vedere
--        le 7 tabelle/colonne coinvolte.
--
-- Prerequisito: i valori nelle colonne FK devono esistere in people.id. Se la
-- migrazione dati è 1:1 (stessi id in people e people3), va bene. Altrimenti
-- aggiorna prima le colonne con la mappa people3_people_map (es. UPDATE ... SET
-- col = (SELECT people_id FROM people3_people_map WHERE people3_id = col)).
--
-- DOPO: esegui database/drop_people3_safe.sql per eliminare people3.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  tbl regclass;
  col text;
  del_rule text;
  upd_rule text;
  new_name text;
BEGIN
  -- Mappa confdeltype/confupdtype → clausola SQL
  -- a=no action, r=restrict, c=cascade, n=set null, d=set default
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
    tbl := r.table_oid;
    col := r.column_name;
    del_rule := CASE r.confdeltype WHEN 'c' THEN ' CASCADE' WHEN 'n' THEN ' SET NULL' WHEN 'r' THEN ' RESTRICT' WHEN 'd' THEN ' SET DEFAULT' ELSE '' END;
    upd_rule := CASE r.confupdtype WHEN 'c' THEN ' CASCADE' WHEN 'n' THEN ' SET NULL' WHEN 'r' THEN ' RESTRICT' WHEN 'd' THEN ' SET DEFAULT' ELSE '' END;
    new_name := r.constraint_name;
    IF new_name LIKE '%people3%' THEN
      new_name := regexp_replace(new_name, 'people3', 'people', 'g');
    ELSE
      new_name := new_name || '_people';
    END IF;

    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I',
      tbl, r.constraint_name
    );
    RAISE NOTICE 'Dropped FK % on %.%', r.constraint_name, tbl, col;

    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.people(id) ON DELETE%s ON UPDATE%s',
      tbl, new_name, col, COALESCE(del_rule, ' RESTRICT'), COALESCE(upd_rule, ' RESTRICT')
    );
    RAISE NOTICE 'Added FK % on %.% → people(id)', new_name, tbl, col;
  END LOOP;
END $$;
