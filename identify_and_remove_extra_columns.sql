-- ========================================
-- IDENTIFICA E RIMUOVI LE 2 COLONNE EXTRA DA PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Identifica le colonne in people che NON sono in people3
SELECT 'COLONNE EXTRA IN PEOPLE:' as info;
SELECT 
    p.column_name,
    p.data_type,
    p.is_nullable
FROM information_schema.columns p
WHERE p.table_name = 'people' 
AND p.table_schema = 'public'
AND p.column_name NOT IN (
    SELECT p3.column_name 
    FROM information_schema.columns p3 
    WHERE p3.table_name = 'people3' 
    AND p3.table_schema = 'public'
)
ORDER BY p.column_name;

-- 2. Identifica le colonne in people3 che NON sono in people
SELECT 'COLONNE MANCANTI IN PEOPLE:' as info;
SELECT 
    p3.column_name,
    p3.data_type,
    p3.is_nullable
FROM information_schema.columns p3
WHERE p3.table_name = 'people3' 
AND p3.table_schema = 'public'
AND p3.column_name NOT IN (
    SELECT p.column_name 
    FROM information_schema.columns p 
    WHERE p.table_name = 'people' 
    AND p.table_schema = 'public'
)
ORDER BY p3.column_name;

-- 3. Mostra il conteggio attuale
SELECT 'CONFRONTO COLONNE:' as info;
SELECT 
    'people' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people' AND table_schema = 'public'
UNION ALL
SELECT 
    'people3' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people3' AND table_schema = 'public';

-- 4. Rimuovi le colonne extra identificate
-- (Questo verrà eseguito solo se ci sono colonne extra)

-- Rimuovi fir_code se esiste
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'fir_code') THEN
        ALTER TABLE public.people DROP COLUMN fir_code;
        RAISE NOTICE 'Rimossa colonna fir_code';
    ELSE
        RAISE NOTICE 'Colonna fir_code già assente';
    END IF;
END $$;

-- Rimuovi birth_year se esiste
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'birth_year') THEN
        ALTER TABLE public.people DROP COLUMN birth_year;
        RAISE NOTICE 'Rimossa colonna birth_year';
    ELSE
        RAISE NOTICE 'Colonna birth_year già assente';
    END IF;
END $$;

-- Rimuovi tutte le colonne guardian1 se esistono
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'guardian1_full_name') THEN
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_full_name;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_relationship;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_email;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_phone;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_can_view;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_can_edit;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian1_is_primary;
        RAISE NOTICE 'Rimosse colonne guardian1';
    ELSE
        RAISE NOTICE 'Colonne guardian1 già assenti';
    END IF;
END $$;

-- Rimuovi tutte le colonne guardian2 se esistono
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'guardian2_full_name') THEN
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_full_name;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_relationship;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_email;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_phone;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_can_view;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_can_edit;
        ALTER TABLE public.people DROP COLUMN IF EXISTS guardian2_is_primary;
        RAISE NOTICE 'Rimosse colonne guardian2';
    ELSE
        RAISE NOTICE 'Colonne guardian2 già assenti';
    END IF;
END $$;

-- Rimuovi tutte le colonne medical_certificate se esistono
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'medical_certificate_kind') THEN
        ALTER TABLE public.people DROP COLUMN IF EXISTS medical_certificate_kind;
        ALTER TABLE public.people DROP COLUMN IF EXISTS medical_certificate_issued_on;
        ALTER TABLE public.people DROP COLUMN IF EXISTS medical_certificate_expires_on;
        ALTER TABLE public.people DROP COLUMN IF EXISTS medical_certificate_provider;
        RAISE NOTICE 'Rimosse colonne medical_certificate';
    ELSE
        RAISE NOTICE 'Colonne medical_certificate già assenti';
    END IF;
END $$;

-- Rimuovi initial_note se esiste
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'initial_note') THEN
        ALTER TABLE public.people DROP COLUMN initial_note;
        RAISE NOTICE 'Rimossa colonna initial_note';
    ELSE
        RAISE NOTICE 'Colonna initial_note già assente';
    END IF;
END $$;

-- 5. Verifica il conteggio finale
SELECT 'CONFRONTO FINALE:' as info;
SELECT 
    'people' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people' AND table_schema = 'public'
UNION ALL
SELECT 
    'people3' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people3' AND table_schema = 'public';

-- 6. Mostra le colonne finali di people
SELECT 'STRUTTURA FINALE PEOPLE:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;
