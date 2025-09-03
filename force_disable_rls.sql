-- Script per FORZARE la disabilitazione di RLS su TUTTE le tabelle

-- 1. DISABILITA RLS SU TUTTE LE TABELLE POSSIBILI
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_members DISABLE ROW LEVEL SECURITY;

-- 2. RIMUOVI TUTTE LE POLITICHE ESISTENTI (FORZA LA RIMOZIONE)
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

-- 3. VERIFICA CHE RLS SIA DISABILITATO
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'staff_categories', 'user_roles', 'categories', 'events', 'players', 'council_members')
  AND schemaname = 'public'
ORDER BY tablename;

-- 4. VERIFICA CHE NON CI SIANO POLITICHE
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE tablename IN ('profiles', 'staff_categories', 'user_roles', 'categories', 'events', 'players', 'council_members')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 5. MESSAGGIO DI CONFERMA
SELECT 'RLS FORZATO A DISABILITATO su tutte le tabelle!' as status;
SELECT 'Ora dovresti poter creare utenti e caricare lo staff senza errori!' as next_step;


