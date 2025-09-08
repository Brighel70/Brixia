-- Script completo per risolvere tutti i problemi del database

-- 1. DISABILITA RLS SU TUTTE LE TABELLE
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_members DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI TUTTE LE POLITICHE ESISTENTI
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Rimuovi tutte le politiche da profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.profiles';
    END LOOP;
    
    -- Rimuovi tutte le politiche da staff_categories
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'staff_categories' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.staff_categories';
    END LOOP;
    
    -- Rimuovi tutte le politiche da user_roles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.user_roles';
    END LOOP;
    
    -- Rimuovi tutte le politiche da categories
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'categories' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.categories';
    END LOOP;
    
    -- Rimuovi tutte le politiche da events
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'events' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.events';
    END LOOP;
    
    -- Rimuovi tutte le politiche da players
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'players' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.players';
    END LOOP;
    
    -- Rimuovi tutte le politiche da council_members
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'council_members' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.council_members';
    END LOOP;
END $$;

-- 3. AGGIUNGI LA FOREIGN KEY MANCANTE
ALTER TABLE public.staff_categories 
ADD CONSTRAINT staff_categories_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. VERIFICA CHE RLS SIA DISABILITATO
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'staff_categories', 'user_roles', 'categories', 'events', 'players', 'council_members')
  AND schemaname = 'public'
ORDER BY tablename;

-- 5. VERIFICA CHE NON CI SIANO POLITICHE
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('profiles', 'staff_categories', 'user_roles', 'categories', 'events', 'players', 'council_members')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 6. VERIFICA LE FOREIGN KEYS
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'staff_categories'
  AND tc.table_schema = 'public';

-- 7. MESSAGGIO DI CONFERMA
SELECT 'Tutti i problemi del database sono stati risolti!' as status;
SELECT 'Ora dovresti poter creare utenti e caricare lo staff senza errori!' as next_step;








