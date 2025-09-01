-- Verifica le categorie mancanti
-- Esegui questo script nel tuo database Supabase

-- 1. Mostra tutte le categorie esistenti
SELECT code, name, active, sort FROM categories ORDER BY sort;

-- 2. Verifica se "Prima Squadra" esiste
SELECT code, name, active FROM categories WHERE code LIKE '%PRIMA%' OR name LIKE '%Prima%';

-- 3. Verifica se ci sono categorie duplicate o con nomi simili
SELECT code, name, COUNT(*) as count 
FROM categories 
GROUP BY code, name 
HAVING COUNT(*) > 1;

-- 4. Mostra le categorie che dovrebbero esserci secondo BRIXIA_CATEGORIES
SELECT 
  'U6' as expected_code, 'Under 6' as expected_name
UNION ALL SELECT 'U8', 'Under 8'
UNION ALL SELECT 'U10', 'Under 10'
UNION ALL SELECT 'U12', 'Under 12'
UNION ALL SELECT 'U14', 'Under 14'
UNION ALL SELECT 'U16', 'Under 16'
UNION ALL SELECT 'U18', 'Under 18'
UNION ALL SELECT 'SENIORES', 'Seniores'
UNION ALL SELECT 'PODEROSA', 'Poderosa'
UNION ALL SELECT 'GUSSAGOLD', 'GussagOld'
UNION ALL SELECT 'BRIXIAOLD', 'Brixia Old'
UNION ALL SELECT 'LEONESSE', 'Leonesse'
ORDER BY expected_code;

