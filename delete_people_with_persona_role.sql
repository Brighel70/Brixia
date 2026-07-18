-- =============================================================================
-- SCRIPT: Elimina tutte le persone catalogate con tag "Persona"
-- =============================================================================
-- Le "Persona" sono persone senza ruoli specifici (né Giocatore, Allenatore, 
-- Tutor, ecc.) - mostrate con il tag "Persona" nella colonna RUOLO.
--
-- ATTENZIONE: Esegui prima la parte PREVIEW per verificare quali record verranno
-- eliminati. L'eliminazione è IRREVERSIBILE.
--
-- Esegui nel SQL Editor di Supabase.
-- =============================================================================

-- =============================================================================
-- PARTE 1: PREVIEW - Verifica quali persone verranno eliminate
-- =============================================================================

SELECT 
  '=== ANTEPRIMA: Persone con tag Persona che verranno eliminate ===' AS info;

-- Persone "Persona" = senza ruoli specifici O con app_role esplicitamente "Persona":
-- - Nessun app_role (o app_role = ruolo "Persona" da user_roles)
-- - Nessun teamflow_app_role  
-- - Nessun staff_roles
-- - Nessun additional_roles / teamflow_additional_roles
-- - is_player = false
-- - is_tutor = false
-- - Nessuna riga in person_staff_roles
-- - Non presenti in players (altrimenti avrebbero Giocatore)
WITH persona_ids AS (
  SELECT p.id
  FROM public.people p
  LEFT JOIN public.user_roles ur ON 
    (p.app_role IS NOT NULL AND p.app_role <> '' AND p.app_role ~ '^[0-9a-f-]{36}$' AND p.app_role::uuid = ur.id)
    OR (p.app_role IS NOT NULL AND p.app_role <> '' AND LOWER(TRIM(p.app_role)) = LOWER(ur.name))
  WHERE 
    (
      COALESCE(NULLIF(TRIM(p.app_role), ''), NULL) IS NULL
      OR (ur.name IS NOT NULL AND LOWER(ur.name) = 'persona')
    )
    AND COALESCE(NULLIF(TRIM(p.teamflow_app_role), ''), NULL) IS NULL
    AND (p.staff_roles IS NULL OR p.staff_roles = '[]'::jsonb OR (jsonb_typeof(p.staff_roles) = 'array' AND (jsonb_array_length(p.staff_roles) IS NULL OR jsonb_array_length(p.staff_roles) = 0)))
    AND (p.additional_roles IS NULL OR array_length(p.additional_roles, 1) IS NULL)
    AND (p.teamflow_additional_roles IS NULL OR p.teamflow_additional_roles = '[]'::jsonb OR (jsonb_typeof(p.teamflow_additional_roles) = 'array' AND (jsonb_array_length(p.teamflow_additional_roles) IS NULL OR jsonb_array_length(p.teamflow_additional_roles) = 0)))
    AND COALESCE(p.is_player, false) = false
    AND COALESCE(p.is_tutor, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.person_staff_roles psr WHERE psr.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.person_id = p.id)
)
SELECT 
  p.id,
  p.given_name,
  p.family_name,
  p.full_name,
  p.email,
  p.fiscal_code,
  p.created_at
FROM public.people p
INNER JOIN persona_ids pi ON pi.id = p.id
ORDER BY p.family_name, p.given_name;

-- Conta quante persone verranno eliminate
WITH persona_ids AS (
  SELECT p.id
  FROM public.people p
  LEFT JOIN public.user_roles ur ON 
    (p.app_role IS NOT NULL AND p.app_role <> '' AND p.app_role ~ '^[0-9a-f-]{36}$' AND p.app_role::uuid = ur.id)
    OR (p.app_role IS NOT NULL AND p.app_role <> '' AND LOWER(TRIM(p.app_role)) = LOWER(ur.name))
  WHERE 
    (
      COALESCE(NULLIF(TRIM(p.app_role), ''), NULL) IS NULL
      OR (ur.name IS NOT NULL AND LOWER(ur.name) = 'persona')
    )
    AND COALESCE(NULLIF(TRIM(p.teamflow_app_role), ''), NULL) IS NULL
    AND (p.staff_roles IS NULL OR p.staff_roles = '[]'::jsonb OR (jsonb_typeof(p.staff_roles) = 'array' AND (jsonb_array_length(p.staff_roles) IS NULL OR jsonb_array_length(p.staff_roles) = 0)))
    AND (p.additional_roles IS NULL OR array_length(p.additional_roles, 1) IS NULL)
    AND (p.teamflow_additional_roles IS NULL OR p.teamflow_additional_roles = '[]'::jsonb OR (jsonb_typeof(p.teamflow_additional_roles) = 'array' AND (jsonb_array_length(p.teamflow_additional_roles) IS NULL OR jsonb_array_length(p.teamflow_additional_roles) = 0)))
    AND COALESCE(p.is_player, false) = false
    AND COALESCE(p.is_tutor, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.person_staff_roles psr WHERE psr.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.person_id = p.id)
)
SELECT COUNT(*) AS totale_persone_da_eliminare FROM persona_ids;


-- =============================================================================
-- PARTE 2: ELIMINAZIONE (decommentare e eseguire SOLO dopo aver verificato la preview)
-- =============================================================================

/*
DO $$
DECLARE
  v_count int;
  r RECORD;
BEGIN
  -- Crea tabella temporanea con gli ID da eliminare
  DROP TABLE IF EXISTS tmp_persona_to_delete;
  CREATE TEMP TABLE tmp_persona_to_delete AS
  SELECT p.id
  FROM public.people p
  LEFT JOIN public.user_roles ur ON 
    (p.app_role IS NOT NULL AND p.app_role <> '' AND p.app_role ~ '^[0-9a-f-]{36}$' AND p.app_role::uuid = ur.id)
    OR (p.app_role IS NOT NULL AND p.app_role <> '' AND LOWER(TRIM(p.app_role)) = LOWER(ur.name))
  WHERE 
    (
      COALESCE(NULLIF(TRIM(p.app_role), ''), NULL) IS NULL
      OR (ur.name IS NOT NULL AND LOWER(ur.name) = 'persona')
    )
    AND COALESCE(NULLIF(TRIM(p.teamflow_app_role), ''), NULL) IS NULL
    AND (p.staff_roles IS NULL OR p.staff_roles = '[]'::jsonb OR (jsonb_typeof(p.staff_roles) = 'array' AND (jsonb_array_length(p.staff_roles) IS NULL OR jsonb_array_length(p.staff_roles) = 0)))
    AND (p.additional_roles IS NULL OR array_length(p.additional_roles, 1) IS NULL)
    AND (p.teamflow_additional_roles IS NULL OR p.teamflow_additional_roles = '[]'::jsonb OR (jsonb_typeof(p.teamflow_additional_roles) = 'array' AND (jsonb_array_length(p.teamflow_additional_roles) IS NULL OR jsonb_array_length(p.teamflow_additional_roles) = 0)))
    AND COALESCE(p.is_player, false) = false
    AND COALESCE(p.is_tutor, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.person_staff_roles psr WHERE psr.person_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.players pl WHERE pl.person_id = p.id);

  SELECT COUNT(*) INTO v_count FROM tmp_persona_to_delete;
  RAISE NOTICE 'Trovate % persone con tag Persona da eliminare', v_count;

  -- 1. Rimuovi invite_used_by su people che puntano a profili delle persone da eliminare
  UPDATE public.people
  SET invite_used_by = NULL
  WHERE invite_used_by IN (SELECT id FROM public.profiles WHERE person_id IN (SELECT id FROM tmp_persona_to_delete));

  -- 2. Elimina da player_guardian_relationships
  DELETE FROM public.player_guardian_relationships
  WHERE player_person_id IN (SELECT id FROM tmp_persona_to_delete)
     OR guardian_person_id IN (SELECT id FROM tmp_persona_to_delete);

  -- 3. Elimina da person_staff_roles
  DELETE FROM public.person_staff_roles
  WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);

  -- 4. Elimina da person_consents (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'person_consents') THEN
    DELETE FROM public.person_consents WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 5. Elimina da documents (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'documents') THEN
    DELETE FROM public.documents WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 6. Elimina da notes (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN
    DELETE FROM public.notes WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 7. Elimina da injuries (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'injuries') THEN
    DELETE FROM public.injuries WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 8. Elimina da medical_certificates (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'medical_certificates') THEN
    DELETE FROM public.medical_certificates WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 9. Elimina da guardians (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guardians') THEN
    DELETE FROM public.guardians 
    WHERE child_person_id IN (SELECT id FROM tmp_persona_to_delete)
       OR guardian_person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 10. Elimina da fee_assignments (se esiste)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_assignments') THEN
    DELETE FROM public.fee_assignments WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);
  END IF;

  -- 11. Elimina da profiles
  DELETE FROM public.profiles WHERE person_id IN (SELECT id FROM tmp_persona_to_delete);

  -- 12. Elimina da people
  DELETE FROM public.people WHERE id IN (SELECT id FROM tmp_persona_to_delete);

  RAISE NOTICE 'Eliminazione completata con successo';
END $$;
*/
