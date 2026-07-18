-- DEPRECATED: usare people. Fix FK documents legacy.
-- =====================================================
-- FIX FOREIGN KEY TABELLA DOCUMENTS
-- =====================================================
-- Risolve: "Key is not present in table people3"
-- La foreign key punta alla tabella sbagliata!

-- =====================================================
-- 1. DIAGNOSI PROBLEMA
-- =====================================================

SELECT '🔍 VERIFICA FOREIGN KEYS ATTUALI' as step;
SELECT '================================================' as separator;

-- Mostra le foreign keys sulla tabella documents
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.documents'::regclass
  AND contype = 'f'
ORDER BY conname;

-- =====================================================
-- 2. ELIMINA FOREIGN KEY SBAGLIATA
-- =====================================================

SELECT '🔧 ELIMINAZIONE FOREIGN KEY ERRATA' as step;
SELECT '================================================' as separator;

-- Elimina la foreign key che punta a people3
DO $$
DECLARE
    constraint_name_var text;
BEGIN
    -- Trova il nome del constraint person_id
    SELECT conname INTO constraint_name_var
    FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%person_id%';
    
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        RAISE NOTICE '✅ Foreign key eliminata: %', constraint_name_var;
    ELSE
        RAISE NOTICE 'ℹ️  Nessuna foreign key person_id trovata';
    END IF;
END $$;

-- =====================================================
-- 3. CREA FOREIGN KEY CORRETTA
-- =====================================================

SELECT '✅ CREAZIONE FOREIGN KEY CORRETTA' as step;
SELECT '================================================' as separator;

-- Crea la foreign key corretta verso la tabella people
ALTER TABLE public.documents
ADD CONSTRAINT documents_person_id_fkey 
FOREIGN KEY (person_id) 
REFERENCES public.people(id) 
ON DELETE CASCADE;

-- =====================================================
-- 4. VERIFICA CORREZIONE
-- =====================================================

SELECT '📊 VERIFICA POST-CORREZIONE' as step;
SELECT '================================================' as separator;

-- Mostra le foreign keys dopo la correzione
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.documents'::regclass
  AND contype = 'f'
ORDER BY conname;

-- Verifica che punti a 'people' e non 'people3'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.documents'::regclass
              AND contype = 'f'
              AND confrelid = 'public.people'::regclass
        ) THEN '✅ Foreign key corretta - punta a public.people'
        ELSE '❌ Foreign key ancora sbagliata'
    END as risultato;

-- =====================================================
-- 5. TEST INSERIMENTO
-- =====================================================

SELECT '🧪 TEST VALIDITÀ' as step;
SELECT '================================================' as separator;

-- Conta quante persone ci sono in people
SELECT 'Persone in tabella people:' as info, COUNT(*) as count
FROM public.people;

-- Conta quanti documenti ci sono
SELECT 'Documenti esistenti:' as info, COUNT(*) as count
FROM public.documents;

-- Mostra alcuni ID di persone per test
SELECT 'Esempi ID persone validi:' as info;
SELECT id, full_name
FROM public.people
LIMIT 5;

-- =====================================================
-- 6. MESSAGGIO FINALE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ FOREIGN KEY CORRETTA CON SUCCESSO!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Cosa è stato fatto:';
  RAISE NOTICE '  ✅ Eliminata foreign key errata (puntava a people3)';
  RAISE NOTICE '  ✅ Creata foreign key corretta (punta a people)';
  RAISE NOTICE '  ✅ Impostato ON DELETE CASCADE';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RISULTATO:';
  RAISE NOTICE '  - Ora puoi inserire documenti per persone esistenti';
  RAISE NOTICE '  - La foreign key punta alla tabella corretta';
  RAISE NOTICE '  - Upload documenti dovrebbe funzionare!';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  PROSSIMI PASSI:';
  RAISE NOTICE '  1. Ricarica l''app (F5)';
  RAISE NOTICE '  2. Vai su Anagrafica → Documenti';
  RAISE NOTICE '  3. Prova a caricare un file';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;














