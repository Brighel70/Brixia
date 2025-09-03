-- Script per ricreare TUTTI i giocatori da zero con dati realistici
-- Questo script cancella tutto e ricrea con dati ben strutturati

-- 1. CANCELLA TUTTI I DATI ESISTENTI
DELETE FROM attendance;
DELETE FROM sessions;
DELETE FROM player_categories;
DELETE FROM players;
DELETE FROM staff_categories;

-- 2. VERIFICA CHE LE CATEGORIE ESISTANO
SELECT 'Categorie disponibili:' as info, code, name, sort FROM categories WHERE active = true ORDER BY sort;

-- 3. CREA GIOCATORI REALISTICI CON DATI COMPLETI
INSERT INTO players (id, first_name, last_name, birth_year, fir_code, role_on_field, injured, aggregated_seniores) VALUES

-- U6 (Under 6) - 4 giocatori nati nel 2018-2019
(gen_random_uuid(), 'Luca', 'Rossi', 2018, 'FIR-U6-LR-001', 'Pilone', false, false),
(gen_random_uuid(), 'Marco', 'Bianchi', 2019, 'FIR-U6-MB-002', 'Tallonatore', false, false),
(gen_random_uuid(), 'Andrea', 'Verdi', 2018, 'FIR-U6-AV-003', 'Pilone', false, false),
(gen_random_uuid(), 'Giuseppe', 'Neri', 2019, 'FIR-U6-GN-004', 'Tallonatore', false, false),

-- U8 (Under 8) - 4 giocatori nati nel 2016-2017
(gen_random_uuid(), 'Francesco', 'Ferrari', 2016, 'FIR-U8-FF-005', 'Pilone', false, false),
(gen_random_uuid(), 'Antonio', 'Russo', 2017, 'FIR-U8-AR-006', 'Tallonatore', false, false),
(gen_random_uuid(), 'Mario', 'Colombo', 2016, 'FIR-U8-MC-007', 'Pilone', false, false),
(gen_random_uuid(), 'Luigi', 'Ricci', 2017, 'FIR-U8-LR-008', 'Tallonatore', false, false),

-- U10 (Under 10) - 4 giocatori nati nel 2014-2015
(gen_random_uuid(), 'Giovanni', 'Marino', 2014, 'FIR-U10-GM-009', 'Pilone', false, false),
(gen_random_uuid(), 'Roberto', 'Greco', 2015, 'FIR-U10-RG-010', 'Tallonatore', false, false),
(gen_random_uuid(), 'Daniele', 'Bruno', 2014, 'FIR-U10-DB-011', 'Pilone', false, false),
(gen_random_uuid(), 'Paolo', 'Galli', 2015, 'FIR-U10-PG-012', 'Tallonatore', false, false),

-- U12 (Under 12) - 4 giocatori nati nel 2012-2013
(gen_random_uuid(), 'Stefano', 'Conti', 2012, 'FIR-U12-SC-013', 'Pilone', false, false),
(gen_random_uuid(), 'Alessandro', 'De Luca', 2013, 'FIR-U12-AD-014', 'Tallonatore', false, false),
(gen_random_uuid(), 'Matteo', 'Costa', 2012, 'FIR-U12-MC-015', 'Pilone', false, false),
(gen_random_uuid(), 'Lorenzo', 'Giordano', 2013, 'FIR-U12-LG-016', 'Tallonatore', false, false),

-- U14 (Under 14) - 4 giocatori nati nel 2010-2011
(gen_random_uuid(), 'Simone', 'Mancini', 2010, 'FIR-U14-SM-017', 'Pilone', false, false),
(gen_random_uuid(), 'Davide', 'Rizzo', 2011, 'FIR-U14-DR-018', 'Tallonatore', false, false),
(gen_random_uuid(), 'Filippo', 'Lombardi', 2010, 'FIR-U14-FL-019', 'Pilone', false, false),
(gen_random_uuid(), 'Gabriele', 'Moretti', 2011, 'FIR-U14-GM-020', 'Tallonatore', false, false),

-- U16 (Under 16) - 4 giocatori nati nel 2008-2009
(gen_random_uuid(), 'Tommaso', 'Barbieri', 2008, 'FIR-U16-TB-021', 'Pilone', false, false),
(gen_random_uuid(), 'Emanuele', 'Fontana', 2009, 'FIR-U16-EF-022', 'Tallonatore', false, false),
(gen_random_uuid(), 'Cristian', 'Santoro', 2008, 'FIR-U16-CS-023', 'Pilone', false, false),
(gen_random_uuid(), 'Alessio', 'Martelli', 2009, 'FIR-U16-AM-024', 'Tallonatore', false, false),

-- U18 (Under 18) - 4 giocatori nati nel 2006-2007
(gen_random_uuid(), 'Riccardo', 'Pellegrini', 2006, 'FIR-U18-RP-025', 'Pilone', false, false),
(gen_random_uuid(), 'Federico', 'Viola', 2007, 'FIR-U18-FV-026', 'Tallonatore', false, false),
(gen_random_uuid(), 'Nicolò', 'Caruso', 2006, 'FIR-U18-NC-027', 'Pilone', false, false),
(gen_random_uuid(), 'Samuele', 'Martinelli', 2007, 'FIR-U18-SM-028', 'Tallonatore', false, false),

-- SERIE C - 4 giocatori nati nel 2004-2005
(gen_random_uuid(), 'Marco', 'Esposito', 2004, 'FIR-SC-ME-029', 'Pilone', false, false),
(gen_random_uuid(), 'Giuseppe', 'Romano', 2005, 'FIR-SC-GR-030', 'Tallonatore', false, false),
(gen_random_uuid(), 'Salvatore', 'Leone', 2004, 'FIR-SC-SL-031', 'Pilone', false, false),
(gen_random_uuid(), 'Fabio', 'Rinaldi', 2005, 'FIR-SC-FR-032', 'Tallonatore', false, false),

-- SERIE B - 4 giocatori nati nel 2002-2003
(gen_random_uuid(), 'Francesco', 'Colombo', 2002, 'FIR-SB-FC-033', 'Pilone', false, false),
(gen_random_uuid(), 'Salvatore', 'Greco', 2003, 'FIR-SB-SG-034', 'Tallonatore', false, false),
(gen_random_uuid(), 'Fabio', 'Moretti', 2002, 'FIR-SB-FM-035', 'Pilone', false, false),
(gen_random_uuid(), 'Giuseppe', 'Russo', 2003, 'FIR-SB-GR-036', 'Tallonatore', false, false),

-- PODEROSA - 4 giocatori nati nel 2000-2001
(gen_random_uuid(), 'Filippo', 'Conti', 2000, 'FIR-POD-FC-037', 'Pilone', false, false),
(gen_random_uuid(), 'Simone', 'Greco', 2001, 'FIR-POD-SG-038', 'Tallonatore', false, false),
(gen_random_uuid(), 'Alessandro', 'Neri', 2000, 'FIR-POD-AN-039', 'Pilone', false, false),
(gen_random_uuid(), 'Marco', 'Santini', 2001, 'FIR-POD-MS-040', 'Tallonatore', false, false),

-- GUSSAGOLD - 4 giocatori nati nel 1998-1999
(gen_random_uuid(), 'Daniele', 'Costa', 1998, 'FIR-GUS-DC-041', 'Pilone', false, false),
(gen_random_uuid(), 'Davide', 'Leone', 1999, 'FIR-GUS-DL-042', 'Tallonatore', false, false),
(gen_random_uuid(), 'Marco', 'Neri', 1998, 'FIR-GUS-MN-043', 'Pilone', false, false),
(gen_random_uuid(), 'Giovanni', 'Verdi', 1999, 'FIR-GUS-GV-044', 'Tallonatore', false, false),

-- BRIXIAOLD - 4 giocatori nati nel 1996-1997
(gen_random_uuid(), 'Emanuele', 'Costa', 1996, 'FIR-BRI-EC-045', 'Pilone', false, false),
(gen_random_uuid(), 'Gabriele', 'Leone', 1997, 'FIR-BRI-GL-046', 'Tallonatore', false, false),
(gen_random_uuid(), 'Adriano', 'Panatta', 1996, 'FIR-BRI-AP-047', 'Pilone', false, false),
(gen_random_uuid(), 'Luca', 'Verdi', 1997, 'FIR-BRI-LV-048', 'Tallonatore', false, false),

-- LEONESSE - 4 giocatori nati nel 1994-1995
(gen_random_uuid(), 'Lorenzo', 'Esposito', 1994, 'FIR-LEO-LE-049', 'Pilone', false, false),
(gen_random_uuid(), 'Alberto', 'Lombardi', 1995, 'FIR-LEO-AL-050', 'Tallonatore', false, false),
(gen_random_uuid(), 'Roberto', 'Pellegrini', 1994, 'FIR-LEO-RP-051', 'Pilone', false, false),
(gen_random_uuid(), 'Federico', 'Viola', 1995, 'FIR-LEO-FV-052', 'Tallonatore', false, false);

-- 4. ASSOCIA I GIOCATORI ALLE LORO CATEGORIE
-- Prima ottieni gli UUID delle categorie
WITH category_mapping AS (
  SELECT 
    id as category_id,
    code,
    ROW_NUMBER() OVER (ORDER BY sort) as cat_order
  FROM categories 
  WHERE active = true
),
player_mapping AS (
  SELECT 
    id as player_id,
    fir_code,
    ROW_NUMBER() OVER (ORDER BY fir_code) as player_order
  FROM players
)
-- Inserisci le associazioni
INSERT INTO player_categories (player_id, category_id)
SELECT 
  p.player_id,
  c.category_id
FROM player_mapping p
JOIN category_mapping c ON ((p.player_order - 1) % 13) + 1 = c.cat_order;

-- 5. VERIFICA IL RISULTATO FINALE
SELECT 
  'RISULTATO FINALE:' as info,
  c.code as categoria,
  c.name as nome_categoria,
  COUNT(pc.player_id) as numero_giocatori,
  STRING_AGG(p.first_name || ' ' || p.last_name, ', ') as giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
LEFT JOIN players p ON pc.player_id = p.id
WHERE c.active = true
GROUP BY c.id, c.code, c.name, c.sort
ORDER BY c.sort;

-- 6. STATISTICHE FINALI
SELECT 
  'STATISTICHE:' as info,
  COUNT(*) as totale_giocatori,
  COUNT(CASE WHEN injured = true THEN 1 END) as infortunati,
  COUNT(CASE WHEN aggregated_seniores = true THEN 1 END) as aggregati_seniores,
  MIN(birth_year) as anno_minimo,
  MAX(birth_year) as anno_massimo
FROM players;





