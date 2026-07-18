-- ========================================
-- FIX: Popola campo role per utenti esistenti
-- ========================================

-- Verifica struttura tabella profiles
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verifica dati esistenti
SELECT id, email, role, user_role_id 
FROM profiles 
LIMIT 10;

-- Se la colonna 'role' esiste ma è NULL, popolala
UPDATE public.profiles 
SET role = ur.name
FROM public.user_roles ur
WHERE profiles.user_role_id = ur.id
AND profiles.role IS NULL;

-- Se la colonna 'role' non esiste, creala e popolala
DO $$
BEGIN
  -- Se non esiste la colonna 'role', la creiamo
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
  ) THEN
    -- Aggiungi colonna role come TEXT
    ALTER TABLE public.profiles ADD COLUMN role TEXT;
    
    -- Popola la colonna 'role' con i nomi dei ruoli dalla tabella user_roles
    UPDATE public.profiles p
    SET role = ur.name
    FROM public.user_roles ur
    WHERE p.user_role_id = ur.id;
    
    -- Imposta un valore di default per chi non ha user_role_id
    UPDATE public.profiles
    SET role = 'Player'
    WHERE role IS NULL;
    
    RAISE NOTICE '✅ Colonna profiles.role creata e popolata';
  ELSE
    RAISE NOTICE '⚠️ Colonna profiles.role esiste già';
  END IF;
END $$;

-- Verifica risultato finale
SELECT id, email, role, user_role_id 
FROM profiles 
LIMIT 10;








