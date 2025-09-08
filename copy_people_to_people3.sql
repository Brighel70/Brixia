-- ========================================
-- COPIA DATI DA PEOPLE A PEOPLE3
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica i dati attuali
SELECT 'VERIFICA INIZIALE:' as info;
SELECT 
    'people' as table_name,
    COUNT(*) as record_count
FROM public.people
UNION ALL
SELECT 
    'people3' as table_name,
    COUNT(*) as record_count
FROM public.people3;

-- 2. Mostra alcuni esempi di dati in people
SELECT 'ESEMPI DATI PEOPLE:' as info;
SELECT 
    id,
    full_name,
    email,
    phone,
    is_minor,
    is_player,
    is_staff,
    injured,
    status
FROM public.people 
LIMIT 5;

-- 3. Verifica la struttura delle due tabelle
SELECT 'STRUTTURA PEOPLE:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'STRUTTURA PEOPLE3:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people3' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Se people ha dati, procedi con la copia
DO $$ 
BEGIN
    IF (SELECT COUNT(*) FROM public.people) > 0 THEN
        RAISE NOTICE 'Trovati dati in people, procedo con la copia...';
        
        -- Cancella i dati esistenti in people3
        TRUNCATE TABLE public.people3 RESTART IDENTITY CASCADE;
        RAISE NOTICE 'Dati di people3 cancellati';
        
        -- Copia i dati da people a people3
        INSERT INTO public.people3 (
            id, full_name, given_name, family_name, date_of_birth, is_minor, gender, 
            fiscal_code, email, phone, address_street, address_city, address_zip, 
            address_region, address_country, nationality, emergency_contact_name, 
            emergency_contact_phone, medical_notes, membership_number, status, 
            created_at, updated_at, is_player, is_staff, injured, staff_roles, 
            staff_categories, player_categories, player_positions
        )
        SELECT 
            id, full_name, given_name, family_name, date_of_birth, is_minor, gender, 
            fiscal_code, email, phone, address_street, address_city, address_zip, 
            address_region, address_country, nationality, emergency_contact_name, 
            emergency_contact_phone, medical_notes, membership_number, status, 
            created_at, updated_at, is_player, is_staff, injured, staff_roles, 
            staff_categories, player_categories, player_positions
        FROM public.people;
        
        RAISE NOTICE 'Dati copiati da people a people3';
        
    ELSE
        RAISE NOTICE 'Nessun dato trovato in people, copia non eseguita';
    END IF;
END $$;

-- 5. Verifica il risultato finale
SELECT 'VERIFICA FINALE:' as info;
SELECT 
    'people' as table_name,
    COUNT(*) as record_count
FROM public.people
UNION ALL
SELECT 
    'people3' as table_name,
    COUNT(*) as record_count
FROM public.people3;

-- 6. Mostra alcuni esempi di dati copiati in people3
SELECT 'ESEMPI DATI PEOPLE3:' as info;
SELECT 
    id,
    full_name,
    email,
    phone,
    is_minor,
    is_player,
    is_staff,
    injured,
    status
FROM public.people3 
LIMIT 5;

-- 7. Verifica che i dati siano identici
SELECT 'CONFRONTO DATI:' as info;
SELECT 
    'people' as source,
    COUNT(*) as count,
    COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) as with_name,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email
FROM public.people
UNION ALL
SELECT 
    'people3' as source,
    COUNT(*) as count,
    COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) as with_name,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email
FROM public.people3;
