-- ========================================
-- RIMUOVI LE 2 COLONNE EXTRA SPECIFICHE DA PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Mostra il conteggio attuale
SELECT 'CONFRONTO INIZIALE:' as info;
SELECT 
    'people' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people' AND table_schema = 'public'
UNION ALL
SELECT 
    'people3' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people3' AND table_schema = 'public';

-- 2. Rimuovi la colonna duplicata "is_player (TRUE/FALSE)"
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'is_player (TRUE/FALSE)') THEN
        ALTER TABLE public.people DROP COLUMN "is_player (TRUE/FALSE)";
        RAISE NOTICE 'Rimossa colonna duplicata "is_player (TRUE/FALSE)"';
    ELSE
        RAISE NOTICE 'Colonna "is_player (TRUE/FALSE)" già assente';
    END IF;
END $$;

-- 3. Rimuovi la colonna "initial_note (optional)"
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'initial_note (optional)') THEN
        ALTER TABLE public.people DROP COLUMN "initial_note (optional)";
        RAISE NOTICE 'Rimossa colonna "initial_note (optional)"';
    ELSE
        RAISE NOTICE 'Colonna "initial_note (optional)" già assente';
    END IF;
END $$;

-- 4. Verifica il conteggio finale
SELECT 'CONFRONTO FINALE:' as info;
SELECT 
    'people' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people' AND table_schema = 'public'
UNION ALL
SELECT 
    'people3' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'people3' AND table_schema = 'public';

-- 5. Mostra le colonne finali di people (solo i nomi)
SELECT 'COLONNE FINALI PEOPLE:' as info;
SELECT column_name
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Verifica che i dati esistenti siano ancora presenti
SELECT 'VERIFICA DATI:' as info;
SELECT COUNT(*) as total_records FROM public.people;

-- 7. Mostra alcuni esempi di dati esistenti
SELECT 
  id,
  full_name,
  email,
  phone,
  is_minor,
  is_player,
  is_staff,
  injured
FROM public.people 
LIMIT 5;
