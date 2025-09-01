-- SCRIPT DI EMERGENZA per risolvere il problema dei valori NULL nel campo sort
-- Esegui questo script se hai già errori con il campo sort

-- 1. Prima rendi il campo sort nullable temporaneamente
ALTER TABLE categories ALTER COLUMN sort DROP NOT NULL;

-- 2. Popola TUTTI i valori sort mancanti
UPDATE categories SET sort = 1 WHERE code = 'U14';
UPDATE categories SET sort = 2 WHERE code = 'U16';
UPDATE categories SET sort = 3 WHERE code = 'U18';
UPDATE categories SET sort = 4 WHERE code = 'CADETTA';
UPDATE categories SET sort = 5 WHERE code = 'PRIMA';
UPDATE categories SET sort = 6 WHERE code = 'SENIORES';

-- 3. Per eventuali altre categorie, assegna un valore alto
UPDATE categories 
SET sort = 999 
WHERE sort IS NULL;

-- 4. Ora rendi il campo sort NOT NULL
ALTER TABLE categories ALTER COLUMN sort SET NOT NULL;

-- 5. Verifica che tutto sia corretto
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY sort;

-- 6. Se tutto è OK, crea l'indice
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort);


