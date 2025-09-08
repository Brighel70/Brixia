-- ========================================
-- INSERISCI DATI DI TEST NELLA TABELLA PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- Prima verifica la struttura attuale
SELECT 'STRUTTURA ATTUALE PEOPLE:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Inserisci alcuni dati di test
INSERT INTO public.people (
    id,
    full_name,
    given_name,
    family_name,
    date_of_birth,
    is_minor,
    gender,
    email,
    phone,
    status,
    is_player,
    is_staff,
    injured,
    created_at,
    updated_at
) VALUES 
(
    gen_random_uuid(),
    'Mario Rossi',
    'Mario',
    'Rossi',
    '1990-05-15',
    false,
    'M',
    'mario.rossi@email.com',
    '+39 123 456 7890',
    'active',
    true,
    false,
    false,
    now(),
    now()
),
(
    gen_random_uuid(),
    'Giulia Bianchi',
    'Giulia',
    'Bianchi',
    '2005-03-22',
    true,
    'F',
    'giulia.bianchi@email.com',
    '+39 098 765 4321',
    'active',
    true,
    false,
    false,
    now(),
    now()
),
(
    gen_random_uuid(),
    'Marco Verdi',
    'Marco',
    'Verdi',
    '1985-11-08',
    false,
    'M',
    'marco.verdi@email.com',
    '+39 555 123 4567',
    'active',
    false,
    true,
    false,
    now(),
    now()
);

-- Verifica che i dati siano stati inseriti
SELECT 'VERIFICA INSERIMENTO:' as info;
SELECT COUNT(*) as total_records FROM public.people;

-- Mostra i dati inseriti
SELECT 'DATI INSERITI:' as info;
SELECT 
    id,
    full_name,
    email,
    phone,
    status,
    is_player,
    is_staff,
    injured
FROM public.people 
ORDER BY created_at DESC;
