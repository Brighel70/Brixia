-- ========================================
-- Aggiungi campi sponsor alla tabella tutors
-- ========================================

-- Aggiungi i campi is_sponsor_potential e is_club_useful alla tabella tutors
ALTER TABLE public.tutors 
ADD COLUMN IF NOT EXISTS is_sponsor_potential boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_club_useful boolean NOT NULL DEFAULT false;

-- Aggiungi commenti per documentare i campi
COMMENT ON COLUMN public.tutors.is_sponsor_potential IS 'Tutor con potenziale sponsor';
COMMENT ON COLUMN public.tutors.is_club_useful IS 'Tutor utile per il club';

-- Crea indici per performance (opzionale)
CREATE INDEX IF NOT EXISTS idx_tutors_sponsor_potential ON public.tutors(is_sponsor_potential);
CREATE INDEX IF NOT EXISTS idx_tutors_club_useful ON public.tutors(is_club_useful);

-- Verifica la struttura aggiornata
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tutors' 
  AND table_schema = 'public'
  AND column_name IN ('is_sponsor_potential', 'is_club_useful')
ORDER BY ordinal_position;

