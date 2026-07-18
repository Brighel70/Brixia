-- =============================================================================
-- MIGRAZIONE PONTE: people3 → people (fase safe - Prompt #5)
-- =============================================================================
-- Eseguibile più volte (idempotente). NON elimina tabelle, NON modifica FK esistenti.
-- Prepara i dati per la migrazione completa (Prompt #6).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. COLONNA PONTE su people
-- -----------------------------------------------------------------------------
ALTER TABLE public.people 
  ADD COLUMN IF NOT EXISTS legacy_people3_id UUID;

COMMENT ON COLUMN public.people.legacy_people3_id IS 'ID del record corrispondente in people3 (deprecata). Usato per mapping durante migrazione.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_people_legacy_people3_id 
  ON public.people(legacy_people3_id) 
  WHERE legacy_people3_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. TABELLA MAPPING (opzionale ma utile per audit)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.people3_people_map (
  people3_id UUID NOT NULL,
  people_id UUID NOT NULL,
  match_method TEXT NOT NULL CHECK (match_method IN ('email', 'name_dob', 'id_equal', 'manual', 'inserted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (people3_id)
);

COMMENT ON TABLE public.people3_people_map IS 'Mapping people3 → people per migrazione. Idempotente.';

-- Rimuovi UNIQUE(people_id) se esiste: più people3 possono mappare allo stesso people (duplicati)
ALTER TABLE public.people3_people_map DROP CONSTRAINT IF EXISTS people3_people_map_people_id_key;

CREATE INDEX IF NOT EXISTS idx_people3_people_map_people_id 
  ON public.people3_people_map(people_id);

-- -----------------------------------------------------------------------------
-- 3. TABELLA AUDIT per tracciare la migrazione
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.people_migration_audit (
  people3_id UUID NOT NULL PRIMARY KEY,
  matched_people_id UUID,
  match_method TEXT NOT NULL CHECK (match_method IN ('email', 'name_dob', 'id_equal', 'manual', 'inserted', 'none')),
  status TEXT NOT NULL CHECK (status IN ('matched', 'inserted', 'needs_review', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.people_migration_audit IS 'Audit migrazione people3→people. Un record per ogni people3.';

CREATE INDEX IF NOT EXISTS idx_people_migration_audit_status 
  ON public.people_migration_audit(status);

CREATE INDEX IF NOT EXISTS idx_people_migration_audit_matched 
  ON public.people_migration_audit(matched_people_id) 
  WHERE matched_people_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. BACKFILL: match e popolamento (best effort, idempotente)
-- -----------------------------------------------------------------------------
-- Verifica che people3 esista prima di procedere
DO $$
DECLARE
  v_people3_exists BOOLEAN;
  v_people_exists BOOLEAN;
  v_count_matched INT := 0;
  v_count_inserted INT := 0;
  v_count_review INT := 0;
  v_count_skipped INT := 0;
  v_p3 RECORD;
  v_people_id UUID;
  v_match_method TEXT;
  v_status TEXT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people3') INTO v_people3_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people') INTO v_people_exists;

  IF NOT v_people3_exists THEN
    RAISE NOTICE 'people3 non esiste. Skip backfill.';
    RETURN;
  END IF;

  IF NOT v_people_exists THEN
    RAISE NOTICE 'people non esiste. Skip backfill.';
    RETURN;
  END IF;

  -- Verifica colonne minime in people per insert
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'full_name') THEN
    RAISE NOTICE 'people.full_name mancante. Skip backfill.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'people3' AND column_name = 'id') THEN
    RAISE NOTICE 'people3.id mancante. Skip backfill.';
    RETURN;
  END IF;

  RAISE NOTICE 'Inizio backfill people3 → people...';

  FOR v_p3 IN 
    SELECT p3.id, p3.full_name, p3.given_name, p3.family_name, p3.date_of_birth, p3.email,
           p3.fiscal_code, p3.phone, p3.gender, p3.is_minor, p3.status,
           p3.is_player, p3.is_staff, p3.injured, p3.staff_roles, p3.staff_categories,
           p3.player_categories, p3.player_positions, p3.created_at, p3.updated_at,
           p3.address_street, p3.address_city, p3.address_zip, p3.address_region, p3.address_country,
           p3.nationality, p3.emergency_contact_name, p3.emergency_contact_phone,
           p3.medical_notes, p3.membership_number
    FROM public.people3 p3
    WHERE NOT EXISTS (SELECT 1 FROM public.people_migration_audit a WHERE a.people3_id = p3.id)
  LOOP
    v_people_id := NULL;
    v_match_method := 'none';
    v_status := 'needs_review';

    -- 1) Match per ID uguale (se people ha già lo stesso id)
    SELECT id INTO v_people_id FROM public.people WHERE id = v_p3.id LIMIT 1;
    IF v_people_id IS NOT NULL THEN
      v_match_method := 'id_equal';
      v_status := 'matched';
    END IF;

    -- 2) Match per email (se non ancora trovato e email presente)
    IF v_people_id IS NULL AND v_p3.email IS NOT NULL AND TRIM(v_p3.email) != '' THEN
      SELECT id INTO v_people_id FROM public.people 
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_p3.email)) 
      LIMIT 1;
      IF v_people_id IS NOT NULL THEN
        v_match_method := 'email';
        v_status := 'matched';
      END IF;
    END IF;

    -- 3) Match per nome+cognome+data nascita (se colonne esistono)
    IF v_people_id IS NULL AND v_p3.date_of_birth IS NOT NULL THEN
      SELECT id INTO v_people_id FROM public.people 
      WHERE date_of_birth = v_p3.date_of_birth
        AND COALESCE(TRIM(given_name), '') = COALESCE(TRIM(v_p3.given_name), '')
        AND COALESCE(TRIM(family_name), '') = COALESCE(TRIM(v_p3.family_name), '')
      LIMIT 1;
      IF v_people_id IS NOT NULL THEN
        v_match_method := 'name_dob';
        v_status := 'matched';
      END IF;
    END IF;

    -- 4) Se non matchato: inserisci in people (solo se campi minimi ok)
    IF v_people_id IS NULL AND v_p3.full_name IS NOT NULL AND TRIM(v_p3.full_name) != '' THEN
      BEGIN
        INSERT INTO public.people (
          id, full_name, given_name, family_name, date_of_birth, is_minor, gender,
          fiscal_code, email, phone, address_street, address_city, address_zip,
          address_region, address_country, nationality, emergency_contact_name,
          emergency_contact_phone, medical_notes, membership_number, status,
          legacy_people3_id, created_at, updated_at
        )
        VALUES (
          v_p3.id, v_p3.full_name, v_p3.given_name, v_p3.family_name,
          COALESCE(v_p3.date_of_birth, '1900-01-01'::date),
          COALESCE(v_p3.is_minor, false), v_p3.gender,
          v_p3.fiscal_code, CASE WHEN v_p3.email IS NOT NULL THEN LOWER(TRIM(v_p3.email)) ELSE NULL END, v_p3.phone,
          v_p3.address_street, v_p3.address_city, v_p3.address_zip,
          v_p3.address_region, v_p3.address_country, v_p3.nationality,
          v_p3.emergency_contact_name, v_p3.emergency_contact_phone,
          v_p3.medical_notes, v_p3.membership_number,
          COALESCE(v_p3.status, 'active'),
          v_p3.id, v_p3.created_at, COALESCE(v_p3.updated_at, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET legacy_people3_id = EXCLUDED.legacy_people3_id;

        v_people_id := v_p3.id;
        v_match_method := 'inserted';
        v_status := 'inserted';

        -- Aggiorna colonne estese se esistono (is_player, is_staff, etc.)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'is_player') THEN
          UPDATE public.people SET
            is_player = COALESCE(v_p3.is_player, false),
            is_staff = COALESCE(v_p3.is_staff, false),
            injured = COALESCE(v_p3.injured, false),
            staff_roles = v_p3.staff_roles,
            staff_categories = v_p3.staff_categories,
            player_categories = v_p3.player_categories,
            player_positions = v_p3.player_positions,
            updated_at = NOW()
          WHERE id = v_p3.id;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_status := 'needs_review';
        v_match_method := 'none';
        v_people_id := NULL;
      END;
    END IF;

    -- 5) Se ancora nulla: segna needs_review
    IF v_people_id IS NULL THEN
      v_status := 'needs_review';
    END IF;

    -- Inserisci/aggiorna audit (UPSERT)
    INSERT INTO public.people_migration_audit (people3_id, matched_people_id, match_method, status, updated_at)
    VALUES (v_p3.id, v_people_id, v_match_method, v_status, NOW())
    ON CONFLICT (people3_id) DO UPDATE SET
      matched_people_id = EXCLUDED.matched_people_id,
      match_method = EXCLUDED.match_method,
      status = EXCLUDED.status,
      updated_at = NOW();

    -- Aggiorna people.legacy_people3_id se matched/inserted
    IF v_people_id IS NOT NULL THEN
      UPDATE public.people SET legacy_people3_id = v_p3.id WHERE id = v_people_id;
      INSERT INTO public.people3_people_map (people3_id, people_id, match_method)
      VALUES (v_p3.id, v_people_id, v_match_method)
      ON CONFLICT (people3_id) DO UPDATE SET people_id = EXCLUDED.people_id, match_method = EXCLUDED.match_method;
    END IF;

    -- Contatori
    CASE v_status
      WHEN 'matched' THEN v_count_matched := v_count_matched + 1;
      WHEN 'inserted' THEN v_count_inserted := v_count_inserted + 1;
      WHEN 'needs_review' THEN v_count_review := v_count_review + 1;
      ELSE v_count_skipped := v_count_skipped + 1;
    END CASE;
  END LOOP;

  RAISE NOTICE 'Backfill completato. Matched: %, Inserted: %, Needs review: %, Skipped: %', 
    v_count_matched, v_count_inserted, v_count_review, v_count_skipped;
END $$;

-- -----------------------------------------------------------------------------
-- 5. RIEPILOGO (query di verifica)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people_migration_audit') THEN
    RAISE NOTICE '=== RIEPILOGO MIGRAZIONE ===';
    RAISE NOTICE 'Esegui: SELECT status, count(*) FROM people_migration_audit GROUP BY status;';
    RAISE NOTICE 'Per needs_review: SELECT * FROM people_migration_audit WHERE status = ''needs_review'';';
  END IF;
END $$;
