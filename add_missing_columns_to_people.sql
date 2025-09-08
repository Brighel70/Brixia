-- ========================================
-- AGGIUNGI COLONNE MANCANTI A PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima mostra la struttura attuale della tabella people
SELECT 'CURRENT PEOPLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Aggiungi le colonne essenziali mancanti (senza toccare i dati esistenti)

-- Aggiungi created_at se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'created_at') THEN
        ALTER TABLE public.people ADD COLUMN created_at timestamp with time zone DEFAULT now();
        RAISE NOTICE 'Aggiunta colonna created_at';
    ELSE
        RAISE NOTICE 'Colonna created_at già esistente';
    END IF;
END $$;

-- Aggiungi updated_at se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'updated_at') THEN
        ALTER TABLE public.people ADD COLUMN updated_at timestamp with time zone DEFAULT now();
        RAISE NOTICE 'Aggiunta colonna updated_at';
    ELSE
        RAISE NOTICE 'Colonna updated_at già esistente';
    END IF;
END $$;

-- Aggiungi is_player se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_player') THEN
        ALTER TABLE public.people ADD COLUMN is_player boolean DEFAULT false;
        RAISE NOTICE 'Aggiunta colonna is_player';
    ELSE
        RAISE NOTICE 'Colonna is_player già esistente';
    END IF;
END $$;

-- Aggiungi is_staff se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_staff') THEN
        ALTER TABLE public.people ADD COLUMN is_staff boolean DEFAULT false;
        RAISE NOTICE 'Aggiunta colonna is_staff';
    ELSE
        RAISE NOTICE 'Colonna is_staff già esistente';
    END IF;
END $$;

-- Aggiungi is_minor se manca (questo è il campo che hai notato!)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_minor') THEN
        ALTER TABLE public.people ADD COLUMN is_minor boolean DEFAULT false;
        RAISE NOTICE 'Aggiunta colonna is_minor';
    ELSE
        RAISE NOTICE 'Colonna is_minor già esistente';
    END IF;
END $$;

-- Aggiungi given_name se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'given_name') THEN
        ALTER TABLE public.people ADD COLUMN given_name text;
        RAISE NOTICE 'Aggiunta colonna given_name';
    ELSE
        RAISE NOTICE 'Colonna given_name già esistente';
    END IF;
END $$;

-- Aggiungi family_name se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'family_name') THEN
        ALTER TABLE public.people ADD COLUMN family_name text;
        RAISE NOTICE 'Aggiunta colonna family_name';
    ELSE
        RAISE NOTICE 'Colonna family_name già esistente';
    END IF;
END $$;

-- Aggiungi date_of_birth se manca (come date, non text)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'date_of_birth') THEN
        ALTER TABLE public.people ADD COLUMN date_of_birth date;
        RAISE NOTICE 'Aggiunta colonna date_of_birth';
    ELSE
        RAISE NOTICE 'Colonna date_of_birth già esistente';
    END IF;
END $$;

-- Aggiungi gender se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'gender') THEN
        ALTER TABLE public.people ADD COLUMN gender text CHECK (gender IN ('M', 'F', 'X'));
        RAISE NOTICE 'Aggiunta colonna gender';
    ELSE
        RAISE NOTICE 'Colonna gender già esistente';
    END IF;
END $$;

-- Aggiungi injured se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'injured') THEN
        ALTER TABLE public.people ADD COLUMN injured boolean DEFAULT false;
        RAISE NOTICE 'Aggiunta colonna injured';
    ELSE
        RAISE NOTICE 'Colonna injured già esistente';
    END IF;
END $$;

-- Aggiungi status se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'status') THEN
        ALTER TABLE public.people ADD COLUMN status text DEFAULT 'active';
        RAISE NOTICE 'Aggiunta colonna status';
    ELSE
        RAISE NOTICE 'Colonna status già esistente';
    END IF;
END $$;

-- Aggiungi membership_number se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'membership_number') THEN
        ALTER TABLE public.people ADD COLUMN membership_number text;
        RAISE NOTICE 'Aggiunta colonna membership_number';
    ELSE
        RAISE NOTICE 'Colonna membership_number già esistente';
    END IF;
END $$;

-- Aggiungi i campi JSON se mancano
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'staff_roles') THEN
        ALTER TABLE public.people ADD COLUMN staff_roles jsonb;
        RAISE NOTICE 'Aggiunta colonna staff_roles';
    ELSE
        RAISE NOTICE 'Colonna staff_roles già esistente';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'staff_categories') THEN
        ALTER TABLE public.people ADD COLUMN staff_categories jsonb;
        RAISE NOTICE 'Aggiunta colonna staff_categories';
    ELSE
        RAISE NOTICE 'Colonna staff_categories già esistente';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'player_categories') THEN
        ALTER TABLE public.people ADD COLUMN player_categories jsonb;
        RAISE NOTICE 'Aggiunta colonna player_categories';
    ELSE
        RAISE NOTICE 'Colonna player_categories già esistente';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'player_positions') THEN
        ALTER TABLE public.people ADD COLUMN player_positions jsonb;
        RAISE NOTICE 'Aggiunta colonna player_positions';
    ELSE
        RAISE NOTICE 'Colonna player_positions già esistente';
    END IF;
END $$;

-- 3. Mostra la struttura finale della tabella people
SELECT 'FINAL PEOPLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Verifica che i dati esistenti siano ancora presenti
SELECT 'DATA VERIFICATION:' as info;
SELECT COUNT(*) as total_records FROM public.people;

-- 5. Mostra alcuni esempi di dati esistenti
SELECT 
  id,
  full_name,
  email,
  phone
FROM public.people 
LIMIT 5;
