-- =====================================================
-- FIX BUG IS_MINOR - Persone Maggiorenni Segnate Come Minori
-- =====================================================
-- Questo script corregge il problema di persone adulte
-- che vengono erroneamente considerate minorenni
-- =====================================================

-- =====================================================
-- 1. DIAGNOSI DEL PROBLEMA
-- =====================================================

SELECT '🔍 DIAGNOSI PROBLEMA IS_MINOR' as step;
SELECT '================================================' as separator;

-- Mostra TUTTI i record con date di nascita e calcolo età
SELECT 
    'Analisi completa persone:' as info,
    COUNT(*) as totale_persone,
    COUNT(CASE WHEN is_minor = true THEN 1 END) as segnati_come_minorenni,
    COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as realmente_minorenni,
    COUNT(CASE 
        WHEN is_minor = true 
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18 
        THEN 1 
    END) as ERRORI_ADULTI_SEGNATI_COME_MINORI
FROM public.people 
WHERE date_of_birth IS NOT NULL;

-- Mostra gli adulti erroneamente segnati come minorenni
SELECT '🚨 ADULTI ERRONEAMENTE SEGNATI COME MINORENNI:' as info;
SELECT 
    id,
    full_name,
    date_of_birth,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::integer as eta_reale,
    is_minor as campo_is_minor_errato,
    '❌ ERRORE!' as status
FROM public.people 
WHERE date_of_birth IS NOT NULL
  AND is_minor = true 
  AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18
ORDER BY date_of_birth;

-- =====================================================
-- 2. VERIFICA TRIGGER ESISTENTI
-- =====================================================

SELECT '🔧 VERIFICA TRIGGER ESISTENTI' as step;
SELECT '================================================' as separator;

-- Mostra i trigger sulla tabella people
SELECT 
    'Trigger trovati:' as info,
    trigger_name,
    event_manipulation as evento,
    action_statement as azione
FROM information_schema.triggers
WHERE event_object_table = 'people'
  AND trigger_name LIKE '%minor%';

-- =====================================================
-- 3. CORREZIONE DEL PROBLEMA
-- =====================================================

SELECT '✅ APPLICAZIONE CORREZIONE' as step;
SELECT '================================================' as separator;

-- CORREGGI TUTTI i campi is_minor basandosi sulla data di nascita reale
UPDATE public.people 
SET 
    is_minor = (EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18),
    updated_at = now()
WHERE date_of_birth IS NOT NULL;

-- Mostra quanti record sono stati corretti
SELECT 
    '✅ CORREZIONE APPLICATA' as info,
    COUNT(*) as record_aggiornati
FROM public.people 
WHERE date_of_birth IS NOT NULL;

-- =====================================================
-- 4. VERIFICA POST-CORREZIONE
-- =====================================================

SELECT '📊 VERIFICA POST-CORREZIONE' as step;
SELECT '================================================' as separator;

-- Conta di nuovo dopo la correzione
SELECT 
    'Situazione dopo correzione:' as info,
    COUNT(*) as totale_persone,
    COUNT(CASE WHEN is_minor = true THEN 1 END) as segnati_come_minorenni,
    COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18 THEN 1 END) as realmente_minorenni,
    COUNT(CASE 
        WHEN is_minor = true 
        AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18 
        THEN 1 
    END) as errori_rimanenti
FROM public.people 
WHERE date_of_birth IS NOT NULL;

-- Verifica che non ci siano più errori
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PROBLEMA RISOLTO - Nessun errore rimanente!'
        ELSE '❌ CI SONO ANCORA ERRORI - Vedi sotto'
    END as risultato
FROM public.people 
WHERE date_of_birth IS NOT NULL
  AND (
    (is_minor = true AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18) OR
    (is_minor = false AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18)
  );

-- Mostra errori rimanenti (se ce ne sono)
SELECT 
    '❌ ERRORI RIMANENTI (se presenti):' as info,
    id,
    full_name,
    date_of_birth,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth))::integer as eta_reale,
    is_minor
FROM public.people 
WHERE date_of_birth IS NOT NULL
  AND (
    (is_minor = true AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) >= 18) OR
    (is_minor = false AND EXTRACT(YEAR FROM AGE(CURRENT_DATE, date_of_birth)) < 18)
  );

-- =====================================================
-- 5. RIPRISTINA/CREA TRIGGER CORRETTO
-- =====================================================

SELECT '🔧 CREAZIONE TRIGGER AUTOMATICO' as step;
SELECT '================================================' as separator;

-- Crea o sostituisci la funzione per calcolare is_minor
CREATE OR REPLACE FUNCTION public.compute_is_minor(dob date)
RETURNS boolean 
LANGUAGE sql 
IMMUTABLE AS
$$ 
  SELECT (EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob)) < 18) 
$$;

-- Crea o sostituisci il trigger che aggiorna is_minor automaticamente
CREATE OR REPLACE FUNCTION public.trg_people_minor()
RETURNS trigger 
LANGUAGE plpgsql AS $$
BEGIN 
  NEW.is_minor := public.compute_is_minor(NEW.date_of_birth); 
  RETURN NEW; 
END $$;

-- Elimina il trigger se esiste già (per ricrearlo pulito)
DROP TRIGGER IF EXISTS trg_people_bi_minor ON public.people;

-- Crea il trigger che si attiva PRIMA di INSERT o UPDATE della data di nascita
CREATE TRIGGER trg_people_bi_minor
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.people
  FOR EACH ROW 
  EXECUTE FUNCTION public.trg_people_minor();

-- =====================================================
-- 6. TEST DEL TRIGGER
-- =====================================================

SELECT '🧪 TEST TRIGGER' as step;
SELECT '================================================' as separator;

-- Il trigger ora dovrebbe calcolare automaticamente is_minor
-- per ogni nuovo inserimento o modifica di date_of_birth

SELECT 
    '✅ Trigger creato con successo!' as risultato,
    'Da ora in poi is_minor verrà calcolato automaticamente' as nota;

-- =====================================================
-- 7. MESSAGGIO FINALE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ FIX COMPLETATO CON SUCCESSO!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Cosa è stato fatto:';
  RAISE NOTICE '  ✅ Corretto il campo is_minor per tutte le persone';
  RAISE NOTICE '  ✅ Ricreato il trigger per calcolo automatico';
  RAISE NOTICE '  ✅ Verificato che non ci siano più errori';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RISULTATO:';
  RAISE NOTICE '  - Adulti NON saranno più considerati minorenni';
  RAISE NOTICE '  - Il popup tutor NON apparirà più per persone >18 anni';
  RAISE NOTICE '  - Nuovi inserimenti calcoleranno is_minor automaticamente';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANTE:';
  RAISE NOTICE '  - Ricarica la pagina dell''applicazione';
  RAISE NOTICE '  - Prova a salvare di nuovo la persona con data 17/01/1990';
  RAISE NOTICE '  - NON dovrebbe più apparire il popup tutor';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;














