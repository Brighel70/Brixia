-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP people3 — Solo dopo migrazione completata su people e 0 dipendenze
-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Consiglio: esegui prima database/inventory_people3_dependencies.sql
--    e verifica che non ci siano FK/view/function che usano people3.
-- 2. Questo script verifica che nessuna FK punti a people3, poi droppa la tabella.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  fk_count INTEGER;
  r RECORD;
BEGIN
  -- Verifica: nessuna FK che referenzia people3
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_name = 'people3';

  IF fk_count > 0 THEN
    RAISE EXCEPTION 'ABORT: Ci sono % foreign key che puntano a people3. Esegui database/inventory_people3_dependencies.sql e migra le FK su people prima di eliminare people3.', fk_count;
  END IF;

  -- Elimina view che dipendono da people3
  DROP VIEW IF EXISTS public.v_person_medical_status CASCADE;
  -- Altre view che usano people3 (cerca per nome)
  FOR r IN
    SELECT schemaname, viewname
    FROM pg_views
    WHERE schemaname = 'public' AND definition ILIKE '%people3%'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.viewname);
    RAISE NOTICE 'View %.% eliminata (dipendeva da people3).', r.schemaname, r.viewname;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people3') THEN
    DROP TABLE public.people3;
    RAISE NOTICE 'Tabella people3 eliminata con successo.';
  ELSE
    RAISE NOTICE 'Tabella people3 non esiste (già eliminata).';
  END IF;
END $$;
