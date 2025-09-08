-- ========================================
-- Rimuovi campo is_emergency_contact dalla tabella tutor_athlete_relations
-- ========================================

-- Rimuovi il campo is_emergency_contact dalla tabella tutor_athlete_relations
ALTER TABLE public.tutor_athlete_relations 
DROP COLUMN IF EXISTS is_emergency_contact;

-- Aggiorna i commenti
COMMENT ON COLUMN public.tutor_athlete_relations.is_primary_contact IS 'Tutor principale per comunicazioni e contatto di emergenza';

-- Verifica la struttura aggiornata
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tutor_athlete_relations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

