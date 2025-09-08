-- Script per gestire il problema del constraint ck_people_cf
-- Il constraint richiede un codice fiscale italiano valido (16 caratteri con pattern specifico)

-- OPZIONE 1: Verifica il constraint attuale
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'ck_people_cf';

-- OPZIONE 2: Rimuovi temporaneamente il constraint per permettere codici fiscali non validi
-- ATTENZIONE: Questo rimuove la validazione del codice fiscale
-- ALTER TABLE public.people DROP CONSTRAINT IF EXISTS ck_people_cf;

-- OPZIONE 3: Modifica il constraint per essere più permissivo
-- Permette codici fiscali vuoti o con formato più flessibile
-- ALTER TABLE public.people DROP CONSTRAINT IF EXISTS ck_people_cf;
-- ALTER TABLE public.people ADD CONSTRAINT ck_people_cf CHECK (
--     fiscal_code IS NULL OR 
--     fiscal_code = '' OR 
--     length(trim(fiscal_code)) >= 10
-- );

-- OPZIONE 4: Crea una funzione di validazione più permissiva
CREATE OR REPLACE FUNCTION public.is_valid_cf_permissive(cf text)
RETURNS boolean 
LANGUAGE plpgsql AS $$
DECLARE 
  s text := upper(regexp_replace(cf, '\s+', '', 'g'));
BEGIN
  IF s IS NULL OR s = '' THEN 
    RETURN true;  -- CF facoltativo
  END IF;
  -- Permette qualsiasi stringa di almeno 10 caratteri
  IF length(s) < 10 THEN 
    RETURN false; 
  END IF;
  RETURN true;
END $$;

-- Applica il constraint più permissivo
-- ALTER TABLE public.people DROP CONSTRAINT IF EXISTS ck_people_cf;
-- ALTER TABLE public.people ADD CONSTRAINT ck_people_cf CHECK (public.is_valid_cf_permissive(fiscal_code));

-- VERIFICA: Mostra i dati che stanno causando problemi
SELECT 
    id,
    full_name,
    fiscal_code,
    length(fiscal_code) as cf_length,
    public.is_valid_cf(fiscal_code) as is_valid
FROM public.people 
WHERE fiscal_code IS NOT NULL 
  AND fiscal_code != ''
  AND NOT public.is_valid_cf(fiscal_code)
LIMIT 10;

