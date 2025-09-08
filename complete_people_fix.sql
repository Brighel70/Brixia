-- ========================================
-- SOLUZIONE COMPLETA PER LA TABELLA PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica RLS e permessi
SELECT 'VERIFICA RLS:' as info;
SELECT schemaname, tablename, rowsecurity, hasrls 
FROM pg_tables 
WHERE tablename IN ('people', 'people3');

-- 2. Disabilita temporaneamente RLS su people per test
ALTER TABLE public.people DISABLE ROW LEVEL SECURITY;

-- 3. Verifica se ci sono dati in people (dovrebbe funzionare ora)
SELECT 'VERIFICA DATI PEOPLE (RLS disabilitato):' as info;
SELECT COUNT(*) as total_records FROM public.people;

-- 4. Se people è vuota, copia da people3
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
    ELSE
        RAISE NOTICE 'People ha già dati o people3 è vuota';
    END IF;
END $$;

-- 5. Aggiorna tutte le foreign key per puntare a people invece di people3
-- Documents
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_person_id_fkey;
ALTER TABLE public.documents ADD CONSTRAINT documents_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_created_by_fkey;
ALTER TABLE public.documents ADD CONSTRAINT documents_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.people(id);

-- Guardians
ALTER TABLE public.guardians DROP CONSTRAINT IF EXISTS guardians_child_person_id_fkey;
ALTER TABLE public.guardians ADD CONSTRAINT guardians_child_person_id_fkey 
    FOREIGN KEY (child_person_id) REFERENCES public.people(id);

ALTER TABLE public.guardians DROP CONSTRAINT IF EXISTS guardians_guardian_person_id_fkey;
ALTER TABLE public.guardians ADD CONSTRAINT guardians_guardian_person_id_fkey 
    FOREIGN KEY (guardian_person_id) REFERENCES public.people(id);

-- Injuries
ALTER TABLE public.injuries DROP CONSTRAINT IF EXISTS injuries_person_id_fkey;
ALTER TABLE public.injuries ADD CONSTRAINT injuries_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

-- Medical certificates
ALTER TABLE public.medical_certificates DROP CONSTRAINT IF EXISTS medical_certificates_person_id_fkey;
ALTER TABLE public.medical_certificates ADD CONSTRAINT medical_certificates_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

-- Notes
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_person_id_fkey;
ALTER TABLE public.notes ADD CONSTRAINT notes_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

-- Person consents
ALTER TABLE public.person_consents DROP CONSTRAINT IF EXISTS person_consents_person_id_fkey;
ALTER TABLE public.person_consents ADD CONSTRAINT person_consents_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

ALTER TABLE public.person_consents DROP CONSTRAINT IF EXISTS person_consents_signed_by_person_id_fkey;
ALTER TABLE public.person_consents ADD CONSTRAINT person_consents_signed_by_person_id_fkey 
    FOREIGN KEY (signed_by_person_id) REFERENCES public.people(id);

-- Players
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_person_id_fkey;
ALTER TABLE public.players ADD CONSTRAINT players_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

-- Profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_person_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_person_id_fkey 
    FOREIGN KEY (person_id) REFERENCES public.people(id);

-- Tutor athlete relations
ALTER TABLE public.tutor_athlete_relations DROP CONSTRAINT IF EXISTS tutor_athlete_relations_athlete_id_fkey;
ALTER TABLE public.tutor_athlete_relations ADD CONSTRAINT tutor_athlete_relations_athlete_id_fkey 
    FOREIGN KEY (athlete_id) REFERENCES public.people(id);

-- 6. Crea policy RLS per people (se necessario)
-- Prima rimuovi policy esistenti
DROP POLICY IF EXISTS "People are viewable by everyone" ON public.people;
DROP POLICY IF EXISTS "People are viewable by authenticated users" ON public.people;

-- Crea policy per permettere accesso a tutti gli utenti autenticati
CREATE POLICY "People are viewable by authenticated users" ON public.people
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "People are insertable by authenticated users" ON public.people
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "People are updatable by authenticated users" ON public.people
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Riabilita RLS
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- 7. Verifica finale
SELECT 'VERIFICA FINALE:' as info;
SELECT COUNT(*) as people_count FROM public.people;
SELECT COUNT(*) as people3_count FROM public.people3;

-- 8. Mostra alcuni esempi di dati
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

-- 9. Verifica che le foreign key siano aggiornate
SELECT 'VERIFICA FOREIGN KEYS:' as info;
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'people'
ORDER BY tc.table_name;
