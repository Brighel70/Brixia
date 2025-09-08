-- ========================================
-- Aggiungi campi ruolo alla tabella people
-- ========================================

-- Aggiungi i campi is_player e is_staff alla tabella people
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS is_player boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

-- Aggiungi commenti per documentare i campi
COMMENT ON COLUMN public.people.is_player IS 'Indica se la persona è un giocatore';
COMMENT ON COLUMN public.people.is_staff IS 'Indica se la persona è staff';

-- Crea indici per performance (opzionale)
CREATE INDEX IF NOT EXISTS idx_people_is_player ON public.people(is_player);
CREATE INDEX IF NOT EXISTS idx_people_is_staff ON public.people(is_staff);

-- Verifica la struttura aggiornata
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'people' 
  AND table_schema = 'public'
  AND column_name IN ('is_player', 'is_staff')
ORDER BY ordinal_position;

