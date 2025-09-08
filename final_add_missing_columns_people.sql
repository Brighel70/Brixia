-- ========================================
-- AGGIUNGI SOLO I CAMPI VERAMENTE MANCANTI A PEOPLE
-- ========================================
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Prima mostra la struttura attuale della tabella people
SELECT 'CURRENT PEOPLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Aggiungi SOLO i campi che mancano veramente

-- Aggiungi is_staff se manca (questo manca davvero!)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'is_staff') THEN
        ALTER TABLE public.people ADD COLUMN is_staff boolean DEFAULT false;
        RAISE NOTICE 'Aggiunta colonna is_staff';
    ELSE
        RAISE NOTICE 'Colonna is_staff già esistente';
    END IF;
END $$;

-- Aggiungi next_membership_number se manca
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'people' AND column_name = 'next_membership_number') THEN
        ALTER TABLE public.people ADD COLUMN next_membership_number integer DEFAULT 1;
        RAISE NOTICE 'Aggiunta colonna next_membership_number';
    ELSE
        RAISE NOTICE 'Colonna next_membership_number già esistente';
    END IF;
END $$;

-- 3. Correggi il tipo di address_zip da bigint a text per compatibilità
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'address_zip' AND data_type = 'bigint') THEN
        ALTER TABLE public.people ALTER COLUMN address_zip TYPE text;
        RAISE NOTICE 'Convertito address_zip da bigint a text';
    ELSE
        RAISE NOTICE 'address_zip già di tipo text o non esiste';
    END IF;
END $$;

-- 4. Rimuovi TUTTE le colonne che non sono presenti in people3
-- (people ha 33 colonne, people3 ne ha 31 - dobbiamo rimuovere 2 colonne)
-- Rimuovi fir_code
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'fir_code') THEN
        ALTER TABLE public.people DROP COLUMN fir_code;
        RAISE NOTICE 'Rimossa colonna fir_code';
    ELSE
        RAISE NOTICE 'Colonna fir_code già assente';
    END IF;
END $$;

-- Rimuovi birth_year
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'birth_year') THEN
        ALTER TABLE public.people DROP COLUMN birth_year;
        RAISE NOTICE 'Rimossa colonna birth_year';
    ELSE
        RAISE NOTICE 'Colonna birth_year già assente';
    END IF;
END $$;

-- Rimuovi colonne guardian1
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'guardian1_full_name') THEN
        ALTER TABLE public.people DROP COLUMN guardian1_full_name;
        ALTER TABLE public.people DROP COLUMN guardian1_relationship;
        ALTER TABLE public.people DROP COLUMN guardian1_email;
        ALTER TABLE public.people DROP COLUMN guardian1_phone;
        ALTER TABLE public.people DROP COLUMN guardian1_can_view;
        ALTER TABLE public.people DROP COLUMN guardian1_can_edit;
        ALTER TABLE public.people DROP COLUMN guardian1_is_primary;
        RAISE NOTICE 'Rimosse colonne guardian1';
    ELSE
        RAISE NOTICE 'Colonne guardian1 già assenti';
    END IF;
END $$;

-- Rimuovi colonne guardian2
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'guardian2_full_name') THEN
        ALTER TABLE public.people DROP COLUMN guardian2_full_name;
        ALTER TABLE public.people DROP COLUMN guardian2_relationship;
        ALTER TABLE public.people DROP COLUMN guardian2_email;
        ALTER TABLE public.people DROP COLUMN guardian2_phone;
        ALTER TABLE public.people DROP COLUMN guardian2_can_view;
        ALTER TABLE public.people DROP COLUMN guardian2_can_edit;
        ALTER TABLE public.people DROP COLUMN guardian2_is_primary;
        RAISE NOTICE 'Rimosse colonne guardian2';
    ELSE
        RAISE NOTICE 'Colonne guardian2 già assenti';
    END IF;
END $$;

-- Rimuovi colonne medical_certificate
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'medical_certificate_kind') THEN
        ALTER TABLE public.people DROP COLUMN medical_certificate_kind;
        ALTER TABLE public.people DROP COLUMN medical_certificate_issued_on;
        ALTER TABLE public.people DROP COLUMN medical_certificate_expires_on;
        ALTER TABLE public.people DROP COLUMN medical_certificate_provider;
        RAISE NOTICE 'Rimosse colonne medical_certificate';
    ELSE
        RAISE NOTICE 'Colonne medical_certificate già assenti';
    END IF;
END $$;

-- Rimuovi initial_note
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'people' AND column_name = 'initial_note') THEN
        ALTER TABLE public.people DROP COLUMN initial_note;
        RAISE NOTICE 'Rimossa colonna initial_note';
    ELSE
        RAISE NOTICE 'Colonna initial_note già assente';
    END IF;
END $$;

-- Rimuovi altre colonne che potrebbero esserci
-- Rimuovi is_player duplicato se esiste
DO $$ 
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = 'people' AND column_name = 'is_player') > 1 THEN
        -- Rimuovi il secondo is_player (quello con (TRUE/FALSE))
        ALTER TABLE public.people DROP COLUMN IF EXISTS is_player;
        RAISE NOTICE 'Rimosso is_player duplicato';
    ELSE
        RAISE NOTICE 'is_player non duplicato';
    END IF;
END $$;

-- 5. Rimuovi il duplicato is_player se esiste (c'è due volte nella definizione)
-- Prima verifica se ci sono duplicati
DO $$ 
BEGIN
    IF (SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = 'people' AND column_name = 'is_player') > 1 THEN
        RAISE NOTICE 'ATTENZIONE: Campo is_player duplicato rilevato!';
    ELSE
        RAISE NOTICE 'Campo is_player OK (non duplicato)';
    END IF;
END $$;

-- 5. Mostra la struttura finale della tabella people
SELECT 'FINAL PEOPLE COLUMNS:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'people' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Verifica che i dati esistenti siano ancora presenti
SELECT 'DATA VERIFICATION:' as info;
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

-- 8. Confronto con people3 per verificare che abbiamo tutti i campi essenziali
SELECT 'COMPARISON WITH PEOPLE3:' as info;
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
