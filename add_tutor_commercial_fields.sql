-- Aggiunge i campi per il potenziale commerciale alla tabella tutors
ALTER TABLE public.tutors 
ADD COLUMN IF NOT EXISTS is_sponsor_potential boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_club_useful boolean NOT NULL DEFAULT false;

-- Aggiunge commenti per documentare i campi
COMMENT ON COLUMN public.tutors.is_sponsor_potential IS 'Indica se il tutor può essere un potenziale sponsor';
COMMENT ON COLUMN public.tutors.is_club_useful IS 'Indica se il tutor può essere utile al club';

-- Verifica che i campi siano stati aggiunti
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tutors' 
AND column_name IN ('is_sponsor_potential', 'is_club_useful') 
ORDER BY column_name;


