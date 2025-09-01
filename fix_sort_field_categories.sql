-- Script CORRETTO per aggiungere e popolare il campo SORT alla tabella categories
-- Questo script gestisce i valori NULL e li popola correttamente

-- 1. Prima verifica lo stato attuale
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY code;

-- 2. Se il campo sort non esiste, aggiungilo
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'sort'
    ) THEN
        ALTER TABLE categories ADD COLUMN sort INTEGER;
    END IF;
END $$;

-- 3. Popola il campo SORT con i valori di ordinamento corretti
-- Ordine richiesto: Under 14, Under 16, Under 18, Cadetta, Prima Squadra, Seniores

UPDATE categories SET sort = 1 WHERE code = 'U14';
UPDATE categories SET sort = 2 WHERE code = 'U16';
UPDATE categories SET sort = 3 WHERE code = 'U18';
UPDATE categories SET sort = 4 WHERE code = 'CADETTA';
UPDATE categories SET sort = 5 WHERE code = 'PRIMA';
UPDATE categories SET sort = 6 WHERE code = 'SENIORES';

-- 4. Per le categorie che non sono nell'elenco standard, assegna un valore alto
-- Questo è un fallback per categorie future o esistenti non nell'ordine specifico
UPDATE categories 
SET sort = 999 
WHERE sort IS NULL;

-- 5. Ora rendi il campo SORT NOT NULL
ALTER TABLE categories ALTER COLUMN sort SET NOT NULL;

-- 6. Crea un indice per le performance
DROP INDEX IF EXISTS idx_categories_sort;
CREATE INDEX idx_categories_sort ON categories(sort);

-- 7. Verifica finale che tutto sia corretto
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY sort;

-- 8. Verifica che non ci siano più valori NULL
SELECT COUNT(*) as categorie_senza_sort
FROM categories 
WHERE sort IS NULL;


