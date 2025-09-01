-- Script per aggiungere il campo SORT alla tabella categories
-- Questo campo determinerà l'ordine di visualizzazione delle categorie

-- 1. Aggiungi il campo SORT alla tabella categories
ALTER TABLE categories ADD COLUMN sort INTEGER;

-- 2. Popola il campo SORT con i valori di ordinamento corretti
-- Ordine richiesto: Under 14, Under 16, Under 18, Cadetta, Prima Squadra, Seniores

UPDATE categories SET sort = 1 WHERE code = 'U14';
UPDATE categories SET sort = 2 WHERE code = 'U16';
UPDATE categories SET sort = 3 WHERE code = 'U18';
UPDATE categories SET sort = 4 WHERE code = 'CADETTA';
UPDATE categories SET sort = 5 WHERE code = 'PRIMA';
UPDATE categories SET sort = 6 WHERE code = 'SENIORES';

-- 3. Rendi il campo SORT NOT NULL e aggiungi un indice per le performance
ALTER TABLE categories ALTER COLUMN sort SET NOT NULL;
CREATE INDEX idx_categories_sort ON categories(sort);

-- 4. Verifica che i valori siano stati impostati correttamente
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY sort;

-- 5. Se ci sono categorie senza sort, assegna un valore alto (per mantenere compatibilità)
-- Questo è un fallback per categorie future o esistenti non nell'ordine specifico
UPDATE categories 
SET sort = 999 
WHERE sort IS NULL;

-- 6. Verifica finale
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY sort;


