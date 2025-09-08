-- Script per migrazione completa da people3 a people
-- Prima verifichiamo lo stato attuale

-- 1. Conta i record in entrambe le tabelle
SELECT 'people' as table_name, COUNT(*) as record_count FROM public.people
UNION ALL
SELECT 'people3' as table_name, COUNT(*) as record_count FROM public.people3;

-- 2. Verifica se l'ID specifico esiste in people
SELECT 'people' as table_name, id, full_name, created_at 
FROM public.people 
WHERE id = 'd22e30e5-780a-4ecc-98c4-701f0ca92fe6';

-- 3. Verifica se l'ID specifico esiste in people3
SELECT 'people3' as table_name, id, full_name, created_at 
FROM public.people3 
WHERE id = 'd22e30e5-780a-4ecc-98c4-701f0ca92fe6';

-- 4. Svuota la tabella people e copia tutti i dati da people3
TRUNCATE TABLE public.people;

INSERT INTO public.people (
    id, full_name, given_name, family_name, date_of_birth, gender,
    fiscal_code, email, phone, address_street, address_city, address_zip,
    address_country, nationality, emergency_contact_name, emergency_contact_phone,
    medical_notes, membership_number, status, is_player, is_staff, injured,
    player_categories, player_positions, staff_roles, staff_categories,
    created_at, updated_at
)
SELECT 
    id, full_name, given_name, family_name, date_of_birth, gender,
    fiscal_code, email, phone, address_street, address_city, address_zip,
    address_country, nationality, emergency_contact_name, emergency_contact_phone,
    medical_notes, membership_number, status, 
    COALESCE(is_player, false) as is_player,
    COALESCE(is_staff, false) as is_staff,
    COALESCE(injured, false) as injured,
    player_categories, player_positions, staff_roles, staff_categories,
    created_at, updated_at
FROM public.people3;

-- 5. Verifica che i dati siano stati copiati
SELECT 'people dopo migrazione completa' as info, COUNT(*) as record_count FROM public.people;

-- 6. Verifica che l'ID specifico ora esista in people
SELECT 'people' as table_name, id, full_name, created_at 
FROM public.people 
WHERE id = 'd22e30e5-780a-4ecc-98c4-701f0ca92fe6';

-- 7. Mostra i primi 5 record in people
SELECT 'Primi 5 record in people' as info, id, full_name, created_at 
FROM public.people 
ORDER BY created_at DESC 
LIMIT 5;
