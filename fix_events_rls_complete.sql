-- Fix completo RLS policies per events table
-- Questo script rimuove tutte le policy esistenti e ne crea di nuove
-- Esegui questo script nel SQL Editor di Supabase

-- ========================================
-- FASE 1: Disabilita temporaneamente RLS
-- ========================================
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;

-- ========================================
-- FASE 2: Rimuovi TUTTE le policy esistenti
-- ========================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'events'
    )
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.events';
        RAISE NOTICE 'Rimossa policy: %', r.policyname;
    END LOOP;
END $$;

-- Rimuovi anche policy che potrebbero avere nomi diversi
DROP POLICY IF EXISTS "Enable read access for all users" ON public.events;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.events;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Events are insertable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are updatable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are deletable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "users_view_events_policy" ON public.events;
DROP POLICY IF EXISTS "users_insert_events_policy" ON public.events;
DROP POLICY IF EXISTS "users_update_events_policy" ON public.events;
DROP POLICY IF EXISTS "users_delete_events_policy" ON public.events;

-- ========================================
-- FASE 3: Crea nuove policy semplici e permissive
-- ========================================

-- Policy SELECT: Tutti gli utenti autenticati possono leggere eventi
CREATE POLICY "events_select_policy" ON public.events
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Policy INSERT: Tutti gli utenti autenticati possono creare eventi
CREATE POLICY "events_insert_policy" ON public.events
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Policy UPDATE: Tutti gli utenti autenticati possono modificare eventi
CREATE POLICY "events_update_policy" ON public.events
FOR UPDATE 
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Policy DELETE: Tutti gli utenti autenticati possono eliminare eventi
CREATE POLICY "events_delete_policy" ON public.events
FOR DELETE 
USING (auth.role() = 'authenticated');

-- ========================================
-- FASE 4: Riabilita RLS
-- ========================================
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ========================================
-- FASE 5: Verifica
-- ========================================
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'events';
    
    RAISE NOTICE '✅ RLS abilitato su events';
    RAISE NOTICE '✅ Policy create: %', policy_count;
    RAISE NOTICE '✅ Tutti gli utenti autenticati possono ora creare, leggere, modificare ed eliminare eventi';
END $$;
