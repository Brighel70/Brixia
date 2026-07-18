-- ========================================
-- VERIFICA E CREA CATEGORIE PER I GIOCATORI
-- ========================================

-- Verifica se esistono categorie
SELECT 'CATEGORIE ESISTENTI:' as info;
SELECT id, name, code, sort, active FROM categories ORDER BY sort;

-- Se non ci sono categorie, creane alcune di default
INSERT INTO categories (name, code, sort, active)
SELECT 'Under 6', 'U6', 1, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U6');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 8', 'U8', 2, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U8');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 10', 'U10', 3, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U10');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 12', 'U12', 4, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U12');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 14', 'U14', 5, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U14');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 16', 'U16', 6, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U16');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 18', 'U18', 7, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U18');

INSERT INTO categories (name, code, sort, active)
SELECT 'Under 20', 'U20', 8, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'U20');

INSERT INTO categories (name, code, sort, active)
SELECT 'Senior', 'SENIOR', 9, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'SENIOR');

INSERT INTO categories (name, code, sort, active)
SELECT 'Poderosa', 'PODEROSA', 10, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE code = 'PODEROSA');

-- Verifica le categorie dopo l'inserimento
SELECT 'CATEGORIE DOPO INSERIMENTO:' as info;
SELECT id, name, code, sort, active FROM categories ORDER BY sort;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ CATEGORIE VERIFICATE E CREATE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Se le categorie erano vuote, sono state create di default';
  RAISE NOTICE '📋 Ora dovresti vedere le categorie nel tab Giocatore';
  RAISE NOTICE '';
END $$;








