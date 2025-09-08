-- Script per rimuovere i campi body_part_description e treating_doctor dalla tabella injuries
-- FORZA la rimozione anche se le colonne contengono dati

-- Rimuovi il campo body_part_description se esiste (FORZATO)
ALTER TABLE public.injuries DROP COLUMN IF EXISTS body_part_description;

-- Rimuovi il campo treating_doctor se esiste (FORZATO)
ALTER TABLE public.injuries DROP COLUMN IF EXISTS treating_doctor;

-- Verifica che i campi siano stati rimossi correttamente
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'injuries'
AND column_name IN ('body_part_description', 'treating_doctor');

-- Mostra la struttura finale della tabella injuries
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'injuries'
ORDER BY ordinal_position;
