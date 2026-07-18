-- ========================================
-- FIX: Ripristina colonna role o user_role_id
-- ========================================

-- Verifica e crea colonna 'role' come TEXT per compatibilità con il codice frontend
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
    
    -- Rendi NOT NULL
    ALTER TABLE public.profiles ALTER COLUMN role SET NOT NULL;
    
    RAISE NOTICE '✅ Colonna profiles.role creata e popolata da user_roles';
  ELSE
    RAISE NOTICE '⚠️ Colonna profiles.role esiste già';
  END IF;
END $$;

-- Verifica risultato
SELECT id, email, full_name, role, user_role_id 
FROM public.profiles 
LIMIT 5;









