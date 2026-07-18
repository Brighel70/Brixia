-- =====================================================
-- AGGIUNGI COLONNE MANCANTI A TABELLA DOCUMENTS
-- =====================================================
-- Esegui questo script per aggiungere tutte le colonne mancanti

-- =====================================================
-- 1. VERIFICA STATO ATTUALE
-- =====================================================

SELECT 'COLONNE ATTUALI DELLA TABELLA DOCUMENTS:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'documents'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Aggiungi colonna file_size se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' 
    AND column_name = 'file_size'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN file_size integer;
    RAISE NOTICE '✅ Colonna file_size aggiunta';
  ELSE
    RAISE NOTICE '⚠️  Colonna file_size già esistente';
  END IF;
END $$;

-- Aggiungi colonna file_type se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' 
    AND column_name = 'file_type'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN file_type text;
    RAISE NOTICE '✅ Colonna file_type aggiunta';
  ELSE
    RAISE NOTICE '⚠️  Colonna file_type già esistente';
  END IF;
END $$;

-- Aggiungi colonna updated_at se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' 
    AND column_name = 'updated_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
    RAISE NOTICE '✅ Colonna updated_at aggiunta';
  ELSE
    RAISE NOTICE '⚠️  Colonna updated_at già esistente';
  END IF;
END $$;

-- Assicurati che la colonna visibility abbia un valore di default
DO $$
BEGIN
  -- Controlla se la colonna visibility esiste
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'documents' 
    AND column_name = 'visibility'
    AND table_schema = 'public'
  ) THEN
    -- Aggiorna i record esistenti che hanno visibility NULL
    UPDATE public.documents 
    SET visibility = 'staff'
    WHERE visibility IS NULL;
    
    -- Imposta il default se non c'è
    ALTER TABLE public.documents 
    ALTER COLUMN visibility SET DEFAULT 'staff';
    
    RAISE NOTICE '✅ Colonna visibility aggiornata con default';
  ELSE
    RAISE NOTICE 'ℹ️  Colonna visibility non esiste (verrà creata da altro script)';
  END IF;
END $$;

-- Verifica il risultato
SELECT 'COLONNE DOPO LE MODIFICHE:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Messaggio finale
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ COLONNE AGGIUNTE CON SUCCESSO!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Colonne aggiunte:';
  RAISE NOTICE '  ✅ file_size (integer) - dimensione file in bytes';
  RAISE NOTICE '  ✅ file_type (text) - MIME type del file';
  RAISE NOTICE '  ✅ updated_at (timestamptz) - data ultimo aggiornamento';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Ora ricarica l''app e prova di nuovo l''upload!';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;

