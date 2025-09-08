-- ========================================
-- AGGIORNAMENTO STRUTTURA TABELLA PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Aggiungi le colonne mancanti con i tipi corretti
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- 2. Modifica i tipi di dati esistenti per adattarli al programma
-- Cambia is_minor da text a boolean
ALTER TABLE public.people 
ALTER COLUMN "is_minor (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "is_minor (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "is_minor (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

-- Rinomina la colonna per rimuovere il suffisso
ALTER TABLE public.people 
RENAME COLUMN "is_minor (TRUE/FALSE)" TO is_minor;

-- 3. Cambia date_of_birth da text a date (gestisce sia formato italiano che ISO)
ALTER TABLE public.people 
ALTER COLUMN "date_of_birth (YYYY-MM-DD)" TYPE date 
USING CASE 
  WHEN "date_of_birth (YYYY-MM-DD)" ~ '^\d{4}-\d{2}-\d{2}$' THEN "date_of_birth (YYYY-MM-DD)"::date
  WHEN "date_of_birth (YYYY-MM-DD)" ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date("date_of_birth (YYYY-MM-DD)", 'DD/MM/YYYY')
  ELSE NULL
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "date_of_birth (YYYY-MM-DD)" TO date_of_birth;

-- 4. Cambia gender da text con suffisso a text normale
ALTER TABLE public.people 
RENAME COLUMN "gender (M/F/X)" TO gender;

-- 5. Pulisci i dati prima di aggiungere constraint UNIQUE

-- Rimuovi valori duplicati per fiscal_code (mantieni solo il primo)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY fiscal_code ORDER BY created_at) as rn
  FROM public.people 
  WHERE fiscal_code IS NOT NULL AND fiscal_code != ''
)
UPDATE public.people 
SET fiscal_code = NULL 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Rimuovi valori duplicati per membership_number (mantieni solo il primo)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "membership_number (leave blank if auto)" ORDER BY created_at) as rn
  FROM public.people 
  WHERE "membership_number (leave blank if auto)" IS NOT NULL AND "membership_number (leave blank if auto)" != ''
)
UPDATE public.people 
SET "membership_number (leave blank if auto)" = NULL 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 6. Cambia fiscal_code per aggiungere constraint UNIQUE se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'people_fiscal_code_unique' 
                   AND table_name = 'people') THEN
        ALTER TABLE public.people ADD CONSTRAINT people_fiscal_code_unique UNIQUE (fiscal_code);
    END IF;
END $$;

-- 7. Email non deve essere univoco - nessun constraint UNIQUE

-- 8. Cambia membership_number per aggiungere constraint UNIQUE se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'people_membership_number_unique' 
                   AND table_name = 'people') THEN
        ALTER TABLE public.people ADD CONSTRAINT people_membership_number_unique UNIQUE ("membership_number (leave blank if auto)");
    END IF;
END $$;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "membership_number (leave blank if auto)" TO membership_number;

-- 8. Cambia status da text con suffisso a text normale
ALTER TABLE public.people 
RENAME COLUMN "status (active/inactive/pending)" TO status;

-- 9. Cambia is_staff da text a boolean
ALTER TABLE public.people 
ALTER COLUMN "is_staff (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "is_staff (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "is_staff (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "is_staff (TRUE/FALSE)" TO is_staff;

-- 10. Cambia injured da text a boolean
ALTER TABLE public.people 
ALTER COLUMN "injured (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "injured (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "injured (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "injured (TRUE/FALSE)" TO injured;

-- 11. Cambia i campi delle categorie da text a jsonb
ALTER TABLE public.people 
ALTER COLUMN "player_categories (comma-separated CATEGORY CODEs)" TYPE jsonb 
USING CASE 
  WHEN "player_categories (comma-separated CATEGORY CODEs)" IS NULL OR "player_categories (comma-separated CATEGORY CODEs)" = '' THEN NULL
  ELSE to_jsonb(string_to_array("player_categories (comma-separated CATEGORY CODEs)", ','))
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "player_categories (comma-separated CATEGORY CODEs)" TO player_categories;

-- 12. Cambia player_positions da text a jsonb
ALTER TABLE public.people 
ALTER COLUMN "player_positions (comma-separated position names)" TYPE jsonb 
USING CASE 
  WHEN "player_positions (comma-separated position names)" IS NULL OR "player_positions (comma-separated position names)" = '' THEN NULL
  ELSE to_jsonb(string_to_array("player_positions (comma-separated position names)", ','))
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "player_positions (comma-separated position names)" TO player_positions;

-- 13. Cambia staff_roles da text a jsonb
ALTER TABLE public.people 
ALTER COLUMN "staff_roles (comma-separated)" TYPE jsonb 
USING CASE 
  WHEN "staff_roles (comma-separated)" IS NULL OR "staff_roles (comma-separated)" = '' THEN NULL
  ELSE to_jsonb(string_to_array("staff_roles (comma-separated)", ','))
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "staff_roles (comma-separated)" TO staff_roles;

-- 14. Cambia staff_categories da text a jsonb
ALTER TABLE public.people 
ALTER COLUMN "staff_categories (comma-separated CATEGORY CODEs)" TYPE jsonb 
USING CASE 
  WHEN "staff_categories (comma-separated CATEGORY CODEs)" IS NULL OR "staff_categories (comma-separated CATEGORY CODEs)" = '' THEN NULL
  ELSE to_jsonb(string_to_array("staff_categories (comma-separated CATEGORY CODEs)", ','))
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "staff_categories (comma-separated CATEGORY CODEs)" TO staff_categories;

-- 15. Cambia birth_year da bigint a integer
ALTER TABLE public.people 
ALTER COLUMN "birth_year (YYYY)" TYPE integer 
USING "birth_year (YYYY)"::integer;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "birth_year (YYYY)" TO birth_year;

-- 16. Cambia i campi guardian da text a boolean dove necessario
ALTER TABLE public.people 
ALTER COLUMN "guardian1_can_view (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "guardian1_can_view (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "guardian1_can_view (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

-- Rinomina la colonna
ALTER TABLE public.people 
RENAME COLUMN "guardian1_can_view (TRUE/FALSE)" TO guardian1_can_view;

-- Continua con gli altri campi guardian...
ALTER TABLE public.people 
ALTER COLUMN "guardian1_can_edit (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "guardian1_can_edit (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "guardian1_can_edit (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

ALTER TABLE public.people 
RENAME COLUMN "guardian1_can_edit (TRUE/FALSE)" TO guardian1_can_edit;

ALTER TABLE public.people 
ALTER COLUMN "guardian1_is_primary (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "guardian1_is_primary (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "guardian1_is_primary (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

ALTER TABLE public.people 
RENAME COLUMN "guardian1_is_primary (TRUE/FALSE)" TO guardian1_is_primary;

-- Continua con guardian2...
ALTER TABLE public.people 
ALTER COLUMN "guardian2_can_view (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "guardian2_can_view (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "guardian2_can_view (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

ALTER TABLE public.people 
RENAME COLUMN "guardian2_can_view (TRUE/FALSE)" TO guardian2_can_view;

ALTER TABLE public.people 
ALTER COLUMN "guardian2_can_edit (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "guardian2_can_edit (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "guardian2_can_edit (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

ALTER TABLE public.people 
RENAME COLUMN "guardian2_can_edit (TRUE/FALSE)" TO guardian2_can_edit;

ALTER TABLE public.people 
ALTER COLUMN "guardian2_is_primary (TRUE/FALSE)" TYPE boolean 
USING CASE 
  WHEN "guardian2_is_primary (TRUE/FALSE)" = 'TRUE' THEN true 
  WHEN "guardian2_is_primary (TRUE/FALSE)" = 'FALSE' THEN false 
  ELSE false 
END;

ALTER TABLE public.people 
RENAME COLUMN "guardian2_is_primary (TRUE/FALSE)" TO guardian2_is_primary;

-- 17. Cambia i campi medical_certificate da text a date (gestisce sia formato italiano che ISO)
ALTER TABLE public.people 
ALTER COLUMN "medical_certificate_issued_on (YYYY-MM-DD)" TYPE date 
USING CASE 
  WHEN "medical_certificate_issued_on (YYYY-MM-DD)" ~ '^\d{4}-\d{2}-\d{2}$' THEN "medical_certificate_issued_on (YYYY-MM-DD)"::date
  WHEN "medical_certificate_issued_on (YYYY-MM-DD)" ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date("medical_certificate_issued_on (YYYY-MM-DD)", 'DD/MM/YYYY')
  ELSE NULL
END;

ALTER TABLE public.people 
RENAME COLUMN "medical_certificate_issued_on (YYYY-MM-DD)" TO medical_certificate_issued_on;

ALTER TABLE public.people 
ALTER COLUMN "medical_certificate_expires_on (YYYY-MM-DD)" TYPE date 
USING CASE 
  WHEN "medical_certificate_expires_on (YYYY-MM-DD)" ~ '^\d{4}-\d{2}-\d{2}$' THEN "medical_certificate_expires_on (YYYY-MM-DD)"::date
  WHEN "medical_certificate_expires_on (YYYY-MM-DD)" ~ '^\d{2}/\d{2}/\d{4}$' THEN to_date("medical_certificate_expires_on (YYYY-MM-DD)", 'DD/MM/YYYY')
  ELSE NULL
END;

ALTER TABLE public.people 
RENAME COLUMN "medical_certificate_expires_on (YYYY-MM-DD)" TO medical_certificate_expires_on;

-- 18. Rinomina gli altri campi per rimuovere i suffissi
ALTER TABLE public.people 
RENAME COLUMN "medical_certificate_kind (non_agonistico/agonistico)" TO medical_certificate_kind;

-- 19. Aggiungi constraint per i valori validi
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'people_gender_check' 
                   AND table_name = 'people') THEN
        ALTER TABLE public.people ADD CONSTRAINT people_gender_check 
        CHECK (gender IN ('M', 'F', 'X'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'people_status_check' 
                   AND table_name = 'people') THEN
        ALTER TABLE public.people ADD CONSTRAINT people_status_check 
        CHECK (status IN ('active', 'inactive', 'pending'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'people_medical_certificate_kind_check' 
                   AND table_name = 'people') THEN
        ALTER TABLE public.people ADD CONSTRAINT people_medical_certificate_kind_check 
        CHECK (medical_certificate_kind IN ('non_agonistico', 'agonistico'));
    END IF;
END $$;

-- 20. Verifica la struttura finale
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;
