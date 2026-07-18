-- Disabilita temporaneamente RLS su profiles per permettere il login
-- Questo risolve l'errore "Database error querying schema" durante il login

-- =====================================
-- FASE 1: Rimuovi tutte le policy
-- =====================================

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

-- =====================================
-- FASE 2: Disabilita RLS
-- =====================================

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- =====================================
-- FASE 3: Verifica
-- =====================================

DO $$
DECLARE
    rls_status BOOLEAN;
BEGIN
    SELECT rowsecurity INTO rls_status
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles';
    
    IF rls_status = false THEN
        RAISE NOTICE '✅ RLS DISABILITATO su profiles';
        RAISE NOTICE '🚀 Prova ora a fare login!';
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ NOTA: RLS è disabilitato solo temporaneamente per risolvere il problema di login.';
        RAISE NOTICE '   Dopo che il login funziona, possiamo riabilitare RLS con policy corrette.';
    ELSE
        RAISE NOTICE '❌ ERRORE: RLS ancora abilitato';
    END IF;
END $$;
