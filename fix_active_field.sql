-- Verifica e correggi il campo active
-- Esegui questo script nel tuo database Supabase

-- 1. Verifica se il campo active esiste
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'categories' 
      AND column_name = 'active' 
      AND table_schema = 'public'
    ) 
    THEN 'Campo active ESISTE' 
    ELSE 'Campo active NON ESISTE' 
  END as status;

-- 2. Se non esiste, aggiungilo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'categories' 
    AND column_name = 'active' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.categories ADD COLUMN active BOOLEAN DEFAULT false;
    RAISE NOTICE 'Campo active aggiunto';
  ELSE
    RAISE NOTICE 'Campo active già esistente';
  END IF;
END $$;

-- 3. Aggiorna tutte le categorie per essere attive
UPDATE public.categories 
SET active = true 
WHERE code IN ('U6', 'U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'SENIORES', 'PODEROSA', 'GUSSAGOLD', 'BRIXIAOLD', 'LEONESSE');

-- 4. Verifica il risultato
SELECT code, name, active FROM categories ORDER BY sort;

