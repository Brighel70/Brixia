-- ========================================
-- PRE-SETUP: PULIZIA E CONVERSIONE ENUM
-- Esegui QUESTO SCRIPT PRIMA di setup_complete_permissions_rls.sql
-- ========================================

-- ========================================
-- FASE 1: DISABILITA RLS SU TUTTE LE TABELLE
-- ========================================

ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.people DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_permissions DISABLE ROW LEVEL SECURITY;

-- ========================================
-- FASE 2: RIMUOVI TUTTE LE POLICY ESISTENTI
-- ========================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(r.tablename);
        RAISE NOTICE 'Rimossa policy: % su tabella %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- ========================================
-- FASE 3: CONVERTI ROLE DA ENUM A TEXT
-- ========================================

DO $$
BEGIN
  -- Verifica se la colonna esiste e se è di tipo enum
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
    AND udt_name LIKE '%enum%'
  ) THEN
    -- Rimuovi il constraint NOT NULL temporaneamente
    ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
    
    -- Crea una nuova colonna temporanea di tipo TEXT
    ALTER TABLE public.profiles ADD COLUMN role_temp TEXT;
    
    -- Copia i valori convertendoli in TEXT
    UPDATE public.profiles SET role_temp = role::TEXT;
    
    -- Rimuovi la vecchia colonna
    ALTER TABLE public.profiles DROP COLUMN role;
    
    -- Rinomina la colonna temporanea
    ALTER TABLE public.profiles RENAME COLUMN role_temp TO role;
    
    -- Ripristina NOT NULL
    ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
    
    RAISE NOTICE '✅ Colonna profiles.role convertita da ENUM a TEXT';
  ELSE
    RAISE NOTICE '⚠️ Colonna profiles.role è già TEXT o non esiste';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Errore nella conversione: %', SQLERRM;
    -- Tenta di ripulire in caso di errore
    BEGIN
      ALTER TABLE public.profiles DROP COLUMN IF EXISTS role_temp;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
END $$;

-- ========================================
-- FASE 4: RIMUOVI ENUM TYPE SE ESISTE
-- ========================================

DO $$
BEGIN
  -- Rimuovi il tipo enum se esiste
  DROP TYPE IF EXISTS role_enum CASCADE;
  RAISE NOTICE '✅ Tipo ENUM role_enum rimosso';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Tipo ENUM non esisteva o non può essere rimosso: %', SQLERRM;
END $$;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PRE-SETUP COMPLETATO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 PROSSIMO PASSO:';
  RAISE NOTICE '   Esegui ora il file: setup_complete_permissions_rls.sql';
  RAISE NOTICE '';
END $$;









