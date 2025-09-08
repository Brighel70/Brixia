-- ========================================
-- MIGRAZIONE COMPLETA DA PEOPLE3 A PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima mostra le differenze tra le due tabelle
SELECT 'PEOPLE3 COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people3' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'PEOPLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Aggiungi le colonne mancanti essenziali da people3 a people
-- Aggiungi created_at e updated_at se mancano
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'created_at') THEN
        ALTER TABLE public.people ADD COLUMN created_at timestamp with time zone DEFAULT now();
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'updated_at') THEN
        ALTER TABLE public.people ADD COLUMN updated_at timestamp with time zone DEFAULT now();
    END IF;
END $$;

-- Aggiungi is_player se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_player') THEN
        ALTER TABLE public.people ADD COLUMN is_player boolean DEFAULT false;
    END IF;
END $$;

-- Aggiungi is_staff se manca (come boolean, non text)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_staff') THEN
        ALTER TABLE public.people ADD COLUMN is_staff boolean DEFAULT false;
    END IF;
END $$;

-- Aggiungi injured se manca (come boolean, non text)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'injured') THEN
        ALTER TABLE public.people ADD COLUMN injured boolean DEFAULT false;
    END IF;
END $$;

-- Aggiungi status se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'status') THEN
        ALTER TABLE public.people ADD COLUMN status text DEFAULT 'active';
    END IF;
END $$;

-- Aggiungi membership_number se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'membership_number') THEN
        ALTER TABLE public.people ADD COLUMN membership_number text;
    END IF;
END $$;

-- Aggiungi i campi JSON se mancano
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'staff_roles') THEN
        ALTER TABLE public.people ADD COLUMN staff_roles jsonb;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'staff_categories') THEN
        ALTER TABLE public.people ADD COLUMN staff_categories jsonb;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'player_categories') THEN
        ALTER TABLE public.people ADD COLUMN player_categories jsonb;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'player_positions') THEN
        ALTER TABLE public.people ADD COLUMN player_positions jsonb;
    END IF;
END $$;

-- 3. Svuota la tabella people
TRUNCATE TABLE public.people;

-- 4. Copia tutti i dati da people3 a people
-- Prima copia i dati base
INSERT INTO public.people (
  id,
  full_name,
  given_name,
  family_name,
  fiscal_code,
  email,
  phone,
  address_street,
  address_city,
  address_zip,
  address_region,
  address_country,
  nationality,
  emergency_contact_name,
  emergency_contact_phone,
  medical_notes,
  fir_code,
  birth_year,
  created_at,
  updated_at,
  is_player,
  is_staff,
  injured,
  status,
  membership_number,
  staff_roles,
  staff_categories,
  player_categories,
  player_positions
)
SELECT 
  id,
  full_name,
  given_name,
  family_name,
  fiscal_code,
  email,
  phone,
  address_street,
  address_city,
  address_zip,
  address_region,
  address_country,
  nationality,
  emergency_contact_name,
  emergency_contact_phone,
  medical_notes,
  fir_code,
  birth_year,
  created_at,
  updated_at,
  is_player,
  is_staff,
  injured,
  status,
  membership_number,
  staff_roles,
  staff_categories,
  player_categories,
  player_positions
FROM public.people3;

-- 5. Aggiungi i campi legacy per compatibilità (se necessario)
-- Aggiungi date_of_birth come text se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'date_of_birth') THEN
        ALTER TABLE public.people ADD COLUMN date_of_birth text;
    END IF;
END $$;

-- Aggiungi is_minor come text se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_minor') THEN
        ALTER TABLE public.people ADD COLUMN is_minor text;
    END IF;
END $$;

-- Aggiungi gender come text se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'gender') THEN
        ALTER TABLE public.people ADD COLUMN gender text;
    END IF;
END $$;

-- 6. Aggiorna i campi legacy con i dati da people3
UPDATE public.people 
SET 
  date_of_birth = p3.date_of_birth::text,
  is_minor = CASE WHEN p3.is_minor THEN 'TRUE' ELSE 'FALSE' END,
  gender = p3.gender
FROM public.people3 p3 
WHERE public.people.id = p3.id;

-- 7. Verifica che i dati siano stati copiati
SELECT 'MIGRATION COMPLETED' as status;
SELECT COUNT(*) as total_records_in_people FROM public.people;
SELECT COUNT(*) as total_records_in_people3 FROM public.people3;

-- 8. Mostra alcuni esempi di dati copiati
SELECT 
  id,
  full_name,
  email,
  phone,
  is_player,
  is_staff,
  injured,
  status
FROM public.people 
LIMIT 5;