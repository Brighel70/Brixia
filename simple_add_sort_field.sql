-- SCRIPT SEMPLICE per aggiungere il campo SORT alla tabella categories
-- Esegui questo script passo per passo nel tuo database Supabase

-- PASSO 1: Aggiungi il campo SORT (se non esiste)
ALTER TABLE categories ADD COLUMN sort INTEGER;

-- PASSO 2: Popola il campo SORT con i valori corretti
UPDATE categories SET sort = 1 WHERE code = 'U14';
UPDATE categories SET sort = 2 WHERE code = 'U16';
UPDATE categories SET sort = 3 WHERE code = 'U18';
UPDATE categories SET sort = 4 WHERE code = 'CADETTA';
UPDATE categories SET sort = 5 WHERE code = 'PRIMA';
UPDATE categories SET sort = 6 WHERE code = 'SENIORES';

-- PASSO 3: Per eventuali altre categorie, assegna un valore alto
UPDATE categories SET sort = 999 WHERE sort IS NULL;

-- PASSO 4: Verifica che tutto sia corretto
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY sort;

-- PASSO 5: Ora rendi il campo SORT NOT NULL
ALTER TABLE categories ALTER COLUMN sort SET NOT NULL;

-- PASSO 6: Crea un indice per le performance
CREATE INDEX idx_categories_sort ON categories(sort);

-- PASSO 7: Verifica finale
SELECT 
    code,
    name,
    sort,
    created_at
FROM categories 
ORDER BY sort;


