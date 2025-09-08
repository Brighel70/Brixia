-- ========================================
-- COMPLETAMENTO MIGRAZIONI - BRIXIA RUGBY
-- ========================================
-- Questo script completa le migrazioni incomplete

-- 1. VERIFICA MIGRAZIONI INCOMPLETE
SELECT '=== VERIFICA MIGRAZIONI INCOMPLETE ===' as info;

-- Verifica se il campo active esiste in categories
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'active' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo active ESISTE' 
    ELSE 'Campo active MANCANTE - DA AGGIUNGERE' 
  END as status;

-- Verifica se il campo sort esiste in categories
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'sort' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo sort ESISTE' 
    ELSE 'Campo sort MANCANTE - DA AGGIUNGERE' 
  END as status;

-- Verifica se il campo user_role_id esiste in profiles
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' 
      AND column_name = 'user_role_id' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo user_role_id ESISTE' 
    ELSE 'Campo user_role_id MANCANTE - DA AGGIUNGERE' 
  END as status;

-- 2. COMPLETA MIGRAZIONI MANCANTI

-- Aggiungi campo active a categories se mancante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' 
    AND column_name = 'active' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Campo active aggiunto a categories';
  END IF;
END $$;

-- Aggiungi campo sort a categories se mancante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' 
    AND column_name = 'sort' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN sort INTEGER DEFAULT 999;
    RAISE NOTICE 'Campo sort aggiunto a categories';
  END IF;
END $$;

-- Aggiungi campo user_role_id a profiles se mancante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'user_role_id' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN user_role_id UUID;
    RAISE NOTICE 'Campo user_role_id aggiunto a profiles';
  END IF;
END $$;

-- Aggiungi campo fir_code a profiles se mancante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'fir_code' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN fir_code TEXT;
    RAISE NOTICE 'Campo fir_code aggiunto a profiles';
  END IF;
END $$;

-- Aggiungi campo birth_date a profiles se mancante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'birth_date' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN birth_date DATE;
    RAISE NOTICE 'Campo birth_date aggiunto a profiles';
  END IF;
END $$;

-- Aggiungi campo birth_date a players se mancante
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' 
    AND column_name = 'birth_date' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.players ADD COLUMN birth_date DATE;
    RAISE NOTICE 'Campo birth_date aggiunto a players';
  END IF;
END $$;

-- 3. MIGRA DATI ESISTENTI

-- Migra birth_year a birth_date in profiles
UPDATE public.profiles 
SET birth_date = CASE 
  WHEN birth_year IS NOT NULL THEN 
    DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year)
  ELSE NULL 
END
WHERE birth_date IS NULL AND birth_year IS NOT NULL;

-- Migra birth_year a birth_date in players
UPDATE public.players 
SET birth_date = CASE 
  WHEN birth_year IS NOT NULL THEN 
    DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' * (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year)
  ELSE NULL 
END
WHERE birth_date IS NULL AND birth_year IS NOT NULL;

-- Popola campo sort in categories se vuoto
UPDATE public.categories 
SET sort = CASE 
  WHEN code = 'U6' THEN 1
  WHEN code = 'U8' THEN 2
  WHEN code = 'U10' THEN 3
  WHEN code = 'U12' THEN 4
  WHEN code = 'U14' THEN 5
  WHEN code = 'U16' THEN 6
  WHEN code = 'U18' THEN 7
  WHEN code = 'SENIORES' THEN 8
  WHEN code = 'PODEROSA' THEN 9
  WHEN code = 'GUSSAGOLD' THEN 10
  WHEN code = 'BRIXIAOLD' THEN 11
  WHEN code = 'LEONESSE' THEN 12
  ELSE 999
END
WHERE sort = 999 OR sort IS NULL;

-- Popola campo active in categories
UPDATE public.categories 
SET active = true 
WHERE active IS NULL;

-- 4. CREA FOREIGN KEY MANCANTI

-- Aggiungi foreign key user_role_id -> user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_role_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_user_role_id_fkey 
    FOREIGN KEY (user_role_id) REFERENCES public.user_roles(id);
    RAISE NOTICE 'Foreign key profiles_user_role_id_fkey aggiunta';
  END IF;
END $$;

-- 5. CREA INDICI MANCANTI

-- Indice per user_role_id in profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_role_id ON public.profiles(user_role_id);

-- Indice per fir_code in profiles
CREATE INDEX IF NOT EXISTS idx_profiles_fir_code ON public.profiles(fir_code);

-- Indice per birth_date in profiles
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON public.profiles(birth_date);

-- Indice per birth_date in players
CREATE INDEX IF NOT EXISTS idx_players_birth_date ON public.players(birth_date);

-- Indice per active in categories
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(active);

-- 6. AGGIORNA POLITICHE RLS

-- Politica per user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND policyname = 'User roles visibili a tutti'
  ) THEN
    CREATE POLICY "User roles visibili a tutti" ON public.user_roles
      FOR SELECT USING (true);
    RAISE NOTICE 'Politica RLS per user_roles aggiunta';
  END IF;
END $$;

-- Politica per permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'permissions' 
    AND policyname = 'Permissions visibili a tutti'
  ) THEN
    CREATE POLICY "Permissions visibili a tutti" ON public.permissions
      FOR SELECT USING (true);
    RAISE NOTICE 'Politica RLS per permissions aggiunta';
  END IF;
END $$;

-- Politica per role_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'role_permissions' 
    AND policyname = 'Role permissions visibili a tutti'
  ) THEN
    CREATE POLICY "Role permissions visibili a tutti" ON public.role_permissions
      FOR SELECT USING (true);
    RAISE NOTICE 'Politica RLS per role_permissions aggiunta';
  END IF;
END $$;

-- 7. VERIFICA FINALE

SELECT '=== MIGRAZIONI COMPLETATE ===' as info;

-- Verifica campi aggiunti
SELECT 
  'Campi aggiunti:' as info,
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name IN ('active', 'sort', 'user_role_id', 'fir_code', 'birth_date')
ORDER BY table_name, column_name;

-- Verifica foreign key
SELECT 
  'Foreign key create:' as info,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.constraint_name LIKE '%user_role_id%'
ORDER BY tc.table_name;

-- Verifica indici
SELECT 
  'Indici creati:' as info,
  indexname,
  tablename
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Verifica politiche RLS
SELECT 
  'Politiche RLS create:' as info,
  tablename,
  policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT '=== COMPLETAMENTO MIGRAZIONI TERMINATO ===' as info;

