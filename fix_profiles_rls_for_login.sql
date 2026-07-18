-- Fix RLS policies per profiles table per permettere il login
-- L'errore "Database error querying schema" durante il login è spesso causato da policy RLS troppo restrittive

-- =====================================
-- FASE 1: Verifica stato RLS
-- =====================================

-- Controlla se RLS è abilitato
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- =====================================
-- FASE 2: Rimuovi policy esistenti problematiche
-- =====================================

-- Rimuovi tutte le policy esistenti sulla tabella profiles
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles'
    )
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles';
        RAISE NOTICE 'Rimossa policy: %', r.policyname;
    END LOOP;
END $$;

-- Rimuovi anche policy con nomi comuni
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "users_view_profiles_policy" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- =====================================
-- FASE 3: Crea policy semplici e permissive
-- =====================================

-- Policy SELECT: Gli utenti autenticati possono leggere il proprio profilo
-- E tutti i profili per permettere il login (necessario per Supabase auth)
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT 
USING (
  -- L'utente può vedere il proprio profilo
  auth.uid() = id
  OR
  -- Permetti a tutti gli utenti autenticati di vedere i profili (necessario per login)
  auth.role() = 'authenticated'
);

-- Policy INSERT: Gli utenti autenticati possono creare profili
CREATE POLICY "profiles_insert_authenticated" ON public.profiles
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Policy UPDATE: Gli utenti possono modificare il proprio profilo
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy DELETE: Solo gli utenti possono eliminare il proprio profilo (o admin)
CREATE POLICY "profiles_delete_own" ON public.profiles
FOR DELETE 
USING (auth.uid() = id);

-- =====================================
-- FASE 4: Abilita RLS
-- =====================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================
-- FASE 5: Verifica
-- =====================================

DO $$
DECLARE
    policy_count INTEGER;
    rls_status BOOLEAN;
BEGIN
    -- Conta le policy
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles';
    
    -- Verifica RLS
    SELECT rowsecurity INTO rls_status
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles';
    
    RAISE NOTICE '✅ RLS abilitato: %', rls_status;
    RAISE NOTICE '✅ Policy create: %', policy_count;
    RAISE NOTICE '✅ Le policy permettono agli utenti autenticati di leggere i profili';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Prova ora a fare login!';
END $$;

-- =====================================
-- FASE 6: Test query (simula il login)
-- =====================================

-- Questa query simula quella che fa l'app durante il login
-- Esegui questa query mentre sei loggato come utente temp per verificare che funzioni
-- SELECT * FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'temp@brixiarugby.it' LIMIT 1);
