-- ========================================
-- FIX RLS POLICIES PER ACCESSO COMPLETO A PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica le policy RLS esistenti
SELECT 'POLICY RLS ESISTENTI:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'people';

-- 2. Rimuovi TUTTE le policy esistenti su people
DROP POLICY IF EXISTS "People are viewable by everyone" ON public.people;
DROP POLICY IF EXISTS "People are viewable by authenticated users" ON public.people;
DROP POLICY IF EXISTS "People are insertable by authenticated users" ON public.people;
DROP POLICY IF EXISTS "People are updatable by authenticated users" ON public.people;
DROP POLICY IF EXISTS "People are deletable by authenticated users" ON public.people;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.people;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.people;
DROP POLICY IF EXISTS "Enable update for all users" ON public.people;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.people;

-- 3. Crea policy per accesso COMPLETO a tutti gli utenti autenticati
-- Policy per SELECT (lettura)
CREATE POLICY "Enable read access for all authenticated users" ON public.people
    FOR SELECT 
    TO authenticated 
    USING (true);

-- Policy per INSERT (inserimento)
CREATE POLICY "Enable insert for all authenticated users" ON public.people
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- Policy per UPDATE (aggiornamento)
CREATE POLICY "Enable update for all authenticated users" ON public.people
    FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Policy per DELETE (eliminazione)
CREATE POLICY "Enable delete for all authenticated users" ON public.people
    FOR DELETE 
    TO authenticated 
    USING (true);

-- 4. Verifica che RLS sia abilitato
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- 5. Test di accesso ai dati
SELECT 'TEST ACCESSO DATI:' as info;
SELECT COUNT(*) as total_records FROM public.people;

-- 6. Mostra alcuni esempi di dati
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

-- 7. Verifica le nuove policy create
SELECT 'NUOVE POLICY RLS:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'people'
ORDER BY policyname;

-- 8. Se people è ancora vuota, copia da people3
DO $$ 
BEGIN
    IF (SELECT COUNT(*) FROM public.people) = 0 AND (SELECT COUNT(*) FROM public.people3) > 0 THEN
        RAISE NOTICE 'People è vuota, copio da people3...';
        
        -- Copia tutti i dati da people3 a people
        INSERT INTO public.people (
            id, full_name, given_name, family_name, date_of_birth, is_minor, gender,
            fiscal_code, email, phone, address_street, address_city, address_zip,
            address_region, address_country, nationality, emergency_contact_name,
            emergency_contact_phone, medical_notes, membership_number, status,
            is_staff, injured, player_categories, player_positions, staff_roles,
            staff_categories, created_at, updated_at, is_player, next_membership_number
        )
        SELECT 
            id, full_name, given_name, family_name, date_of_birth, is_minor, gender,
            fiscal_code, email, phone, address_street, address_city, address_zip,
            address_region, address_country, nationality, emergency_contact_name,
            emergency_contact_phone, medical_notes, membership_number, status,
            is_staff, injured, player_categories, player_positions, staff_roles,
            staff_categories, created_at, updated_at, is_player, next_membership_number
        FROM public.people3;
        
        RAISE NOTICE 'Dati copiati da people3 a people';
        
        -- Verifica la copia
        RAISE NOTICE 'Record copiati: %', (SELECT COUNT(*) FROM public.people);
    ELSE
        RAISE NOTICE 'People ha già dati o people3 è vuota';
    END IF;
END $$;

-- 9. Verifica finale
SELECT 'VERIFICA FINALE:' as info;
SELECT COUNT(*) as people_count FROM public.people;
SELECT COUNT(*) as people3_count FROM public.people3;

-- 10. Mostra esempi finali
SELECT 'ESEMPI FINALI PEOPLE:' as info;
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
LIMIT 10;
