-- ========================================
-- AGGIUNTA: Colonna app_role alla tabella people
-- ========================================

-- Aggiungi colonna app_role alla tabella people
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS app_role TEXT;

-- Commenta la colonna per documentazione
COMMENT ON COLUMN public.people.app_role IS 'Ruolo della persona nell''applicazione (Admin, Allenatore, Player, etc.)';

-- Crea indice per performance se necessario
CREATE INDEX IF NOT EXISTS idx_people_app_role ON public.people(app_role);

-- Verifica che la colonna sia stata aggiunta
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
AND column_name = 'app_role';

-- Mostra la struttura aggiornata
\d public.people;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ COLONNA app_role AGGIUNTA!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 La colonna app_role è stata aggiunta alla tabella people';
  RAISE NOTICE '📋 Ora il form può salvare il ruolo dell\'app';
  RAISE NOTICE '';
END $$;
