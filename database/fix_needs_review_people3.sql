-- DEPRECATED: usare people. One-off fix già eseguito.
-- =============================================================================
-- FIX MANUALE: 3 record needs_review (people3 → people)
-- =============================================================================
-- Esegui nel SQL Editor di Supabase.
-- Per ogni record: prova match per email, altrimenti inserisci in people.
-- =============================================================================

DO $$
DECLARE
  v_people3_ids UUID[] := ARRAY[
    '9f17e1bf-fdd4-4b11-9ecc-f57d338f3ae5'::UUID,  -- BAO BAO
    '364fd7dd-57ee-4f12-8597-8ae0b0da49c0'::UUID,  -- Andrea Lupatini
    'd1f442b0-aa9e-45e8-99e8-a06d24afd348'::UUID   -- Stefano Marchina
  ];
  v_p3_id UUID;
  v_people_id UUID;
  v_p3 RECORD;
BEGIN
  FOREACH v_p3_id IN ARRAY v_people3_ids
  LOOP
    SELECT * INTO v_p3 FROM people3 WHERE id = v_p3_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'people3 id % non trovato, skip', v_p3_id;
      CONTINUE;
    END IF;

    v_people_id := NULL;

    -- 1) Match per email (case-insensitive)
    IF v_p3.email IS NOT NULL AND TRIM(v_p3.email) != '' THEN
      SELECT id INTO v_people_id FROM people 
      WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_p3.email)) 
      LIMIT 1;
    END IF;

    -- 2) Se non matchato, inserisci in people (o recupera id se email già esiste)
    IF v_people_id IS NULL THEN
      BEGIN
        INSERT INTO people (
          id, full_name, given_name, family_name, date_of_birth, is_minor, gender,
          fiscal_code, email, phone, address_street, address_city, address_zip,
          address_region, address_country, nationality, emergency_contact_name,
          emergency_contact_phone, medical_notes, membership_number, status,
          legacy_people3_id, created_at, updated_at
        )
        VALUES (
          v_p3.id, v_p3.full_name, v_p3.given_name, v_p3.family_name,
          COALESCE(v_p3.date_of_birth, '1990-01-01'::date),
          COALESCE(v_p3.is_minor, false), v_p3.gender,
          v_p3.fiscal_code, LOWER(TRIM(v_p3.email)), v_p3.phone,
          v_p3.address_street, v_p3.address_city, v_p3.address_zip,
          v_p3.address_region, v_p3.address_country, v_p3.nationality,
          v_p3.emergency_contact_name, v_p3.emergency_contact_phone,
          v_p3.medical_notes, v_p3.membership_number,
          COALESCE(v_p3.status, 'active'),
          v_p3.id, v_p3.created_at, COALESCE(v_p3.updated_at, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET legacy_people3_id = EXCLUDED.legacy_people3_id;

        v_people_id := v_p3.id;

        -- Aggiorna colonne estese se esistono
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'people' AND column_name = 'is_player') THEN
          UPDATE people SET
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
      EXCEPTION WHEN unique_violation THEN
        -- Email o fiscal_code già presente: usa il record esistente
        IF v_p3.email IS NOT NULL THEN
          SELECT id INTO v_people_id FROM people WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_p3.email)) LIMIT 1;
        END IF;
        IF v_people_id IS NULL AND v_p3.fiscal_code IS NOT NULL THEN
          SELECT id INTO v_people_id FROM people WHERE fiscal_code = v_p3.fiscal_code LIMIT 1;
        END IF;
      END;
    END IF;

    -- 3) Aggiorna people.legacy_people3_id (se matched)
    IF v_people_id IS NOT NULL THEN
      UPDATE people SET legacy_people3_id = v_p3.id WHERE id = v_people_id;
    END IF;

    -- 4) Aggiorna audit e mapping
    INSERT INTO people_migration_audit (people3_id, matched_people_id, match_method, status, updated_at)
    VALUES (v_p3_id, v_people_id, 
            CASE WHEN v_people_id = v_p3_id THEN 'inserted' ELSE 'manual' END,
            CASE WHEN v_people_id IS NOT NULL THEN 'matched' ELSE 'needs_review' END,
            NOW())
    ON CONFLICT (people3_id) DO UPDATE SET
      matched_people_id = EXCLUDED.matched_people_id,
      match_method = EXCLUDED.match_method,
      status = EXCLUDED.status,
      updated_at = NOW();

    INSERT INTO people3_people_map (people3_id, people_id, match_method)
    VALUES (v_p3_id, v_people_id, 
            CASE WHEN v_people_id = v_p3_id THEN 'inserted' ELSE 'manual' END)
    ON CONFLICT (people3_id) DO UPDATE SET people_id = EXCLUDED.people_id, match_method = EXCLUDED.match_method;

    RAISE NOTICE 'Processato % (%) -> people_id %', v_p3.full_name, v_p3_id, v_people_id;
  END LOOP;

  RAISE NOTICE 'Fix completato. Verifica: SELECT status, count(*) FROM people_migration_audit GROUP BY status;';
END $$;
