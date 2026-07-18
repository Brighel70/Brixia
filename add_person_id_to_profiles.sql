-- =====================================================
-- AGGIUNTA COLONNA person_id ALLA TABELLA profiles
-- =====================================================

-- Aggiungi la colonna person_id se non esiste
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.people(id) ON DELETE CASCADE;

-- Crea indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_profiles_person_id ON public.profiles(person_id);

-- =====================================================
-- FINE SCRIPT
-- =====================================================



