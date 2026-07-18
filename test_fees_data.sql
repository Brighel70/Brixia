-- Script per creare dati di test per le quote e verificare le statistiche per categoria
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Verifica se esistono categorie
SELECT 'Categorie esistenti:' as info, COUNT(*) as count FROM categories WHERE active = true;

-- 2. Verifica se esistono giocatori
SELECT 'Giocatori esistenti:' as info, COUNT(*) as count FROM players;

-- 3. Verifica se esistono associazioni giocatori-categorie
SELECT 'Associazioni giocatori-categorie:' as info, COUNT(*) as count FROM player_categories;

-- 4. Verifica se esistono quote
SELECT 'Quote esistenti:' as info, COUNT(*) as count FROM fees;

-- 5. Verifica se esistono assegnazioni
SELECT 'Assegnazioni esistenti:' as info, COUNT(*) as count FROM fee_assignments;

-- 6. Crea dati di test se non esistono
-- Inserisci alcune categorie se non esistono
INSERT INTO categories (code, name, sort, active) VALUES 
('U8', 'Under 8', 1, true),
('U10', 'Under 10', 2, true),
('U12', 'Under 12', 3, true),
('U14', 'Under 14', 4, true),
('U16', 'Under 16', 5, true),
('U18', 'Under 18', 6, true),
('SENIORES', 'Seniores', 7, true)
ON CONFLICT (code) DO NOTHING;

-- 7. Inserisci alcuni giocatori di test se non esistono
INSERT INTO people (full_name, given_name, family_name, date_of_birth, is_minor, is_player) VALUES 
('Mario Rossi', 'Mario', 'Rossi', '2015-01-15', true, true),
('Giulia Bianchi', 'Giulia', 'Bianchi', '2013-03-20', true, true),
('Luca Verdi', 'Luca', 'Verdi', '2011-05-10', true, true),
('Anna Neri', 'Anna', 'Neri', '2009-07-25', true, true),
('Paolo Blu', 'Paolo', 'Blu', '2007-09-12', true, true)
ON CONFLICT DO NOTHING;

-- 8. Inserisci i giocatori nella tabella players
INSERT INTO players (first_name, last_name, birth_date, person_id)
SELECT p.given_name, p.family_name, p.date_of_birth, p.id
FROM people p
WHERE p.is_player = true AND p.given_name IN ('Mario', 'Giulia', 'Luca', 'Anna', 'Paolo')
ON CONFLICT DO NOTHING;

-- 9. Crea associazioni giocatori-categorie
INSERT INTO player_categories (player_id, category_id)
SELECT p.id, c.id
FROM players p
JOIN people per ON p.person_id = per.id
JOIN categories c ON (
  (per.given_name = 'Mario' AND c.code = 'U8') OR
  (per.given_name = 'Giulia' AND c.code = 'U10') OR
  (per.given_name = 'Luca' AND c.code = 'U12') OR
  (per.given_name = 'Anna' AND c.code = 'U14') OR
  (per.given_name = 'Paolo' AND c.code = 'U16')
)
ON CONFLICT DO NOTHING;

-- 10. Crea alcune quote di test
INSERT INTO fees (name, description, type, amount, category, is_active, is_mandatory) VALUES 
('Quota Iscrizione U8', 'Quota annuale Under 8', 'membership', 5000, 'U8', true, true),
('Quota Iscrizione U10', 'Quota annuale Under 10', 'membership', 6000, 'U10', true, true),
('Quota Iscrizione U12', 'Quota annuale Under 12', 'membership', 7000, 'U12', true, true),
('Quota Iscrizione U14', 'Quota annuale Under 14', 'membership', 8000, 'U14', true, true),
('Quota Iscrizione U16', 'Quota annuale Under 16', 'membership', 9000, 'U16', true, true)
ON CONFLICT DO NOTHING;

-- 11. Crea assegnazioni di test
INSERT INTO fee_assignments (fee_id, person_id, amount, status, due_date)
SELECT f.id, per.id, f.amount, 
  CASE 
    WHEN per.given_name = 'Mario' THEN 'paid'
    WHEN per.given_name = 'Giulia' THEN 'pending'
    WHEN per.given_name = 'Luca' THEN 'overdue'
    ELSE 'pending'
  END,
  CURRENT_DATE + INTERVAL '30 days'
FROM fees f
JOIN categories c ON f.category = c.code
JOIN player_categories pc ON c.id = pc.category_id
JOIN players p ON pc.player_id = p.id
JOIN people per ON p.person_id = per.id
WHERE f.name LIKE 'Quota Iscrizione%'
ON CONFLICT DO NOTHING;

-- 12. Verifica i dati creati
SELECT 'Dati di test creati:' as info;
SELECT 'Categorie:' as tipo, COUNT(*) as count FROM categories WHERE active = true
UNION ALL
SELECT 'Giocatori:' as tipo, COUNT(*) as count FROM players
UNION ALL
SELECT 'Associazioni:' as tipo, COUNT(*) as count FROM player_categories
UNION ALL
SELECT 'Quote:' as tipo, COUNT(*) as count FROM fees WHERE is_active = true
UNION ALL
SELECT 'Assegnazioni:' as tipo, COUNT(*) as count FROM fee_assignments;

-- 13. Mostra le assegnazioni per categoria
SELECT 
  c.name as categoria,
  COUNT(fa.id) as assegnazioni,
  SUM(fa.amount) as totale_centesimi,
  SUM(fa.amount)/100.0 as totale_euro,
  COUNT(CASE WHEN fa.status = 'paid' THEN 1 END) as pagate,
  COUNT(CASE WHEN fa.status = 'pending' THEN 1 END) as in_sospeso,
  COUNT(CASE WHEN fa.status = 'overdue' THEN 1 END) as scadute
FROM fee_assignments fa
JOIN people per ON fa.person_id = per.id
JOIN players p ON per.id = p.person_id
JOIN player_categories pc ON p.id = pc.player_id
JOIN categories c ON pc.category_id = c.id
GROUP BY c.id, c.name, c.sort
ORDER BY c.sort;








