-- Script per creare e popolare i dati staff
-- ADATTATO AL DATABASE ESISTENTE CON UUID

-- 1. Aggiungi colonne mancanti alla tabella profiles se non esistono
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fir_code TEXT;

-- 2. Aggiungi foreign key per staff_categories.user_id se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'staff_categories_user_id_fkey'
    ) THEN
        ALTER TABLE staff_categories 
        ADD CONSTRAINT staff_categories_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.profiles(id);
    END IF;
END $$;

-- 3. Prima scopriamo gli ID delle categorie esistenti
-- (esegui questa query per vedere gli ID)
SELECT id, code, name FROM categories ORDER BY sort;

-- 4. Inserisci le categorie se non esistono (con ID UUID generati)
INSERT INTO categories (id, code, name, sort) VALUES 
(gen_random_uuid(), 'U8', 'Under 8', 1),
(gen_random_uuid(), 'U10', 'Under 10', 2),
(gen_random_uuid(), 'U12', 'Under 12', 3),
(gen_random_uuid(), 'U14', 'Under 14', 4),
(gen_random_uuid(), 'U16', 'Under 16', 5),
(gen_random_uuid(), 'U18', 'Under 18', 6),
(gen_random_uuid(), 'SENIORES', 'Seniores', 7)
ON CONFLICT (code) DO NOTHING;

-- 5. Ora inserisci gli staff usando gli ID UUID delle categorie esistenti
-- Prima recupera gli ID delle categorie
DO $$
DECLARE
    cat_u8_id uuid;
    cat_u10_id uuid;
    cat_u12_id uuid;
    cat_u14_id uuid;
    cat_u16_id uuid;
    cat_u18_id uuid;
    cat_seniores_id uuid;
BEGIN
    -- Recupera gli ID delle categorie
    SELECT id INTO cat_u8_id FROM categories WHERE code = 'U8';
    SELECT id INTO cat_u10_id FROM categories WHERE code = 'U10';
    SELECT id INTO cat_u12_id FROM categories WHERE code = 'U12';
    SELECT id INTO cat_u14_id FROM categories WHERE code = 'U14';
    SELECT id INTO cat_u16_id FROM categories WHERE code = 'U16';
    SELECT id INTO cat_u18_id FROM categories WHERE code = 'U18';
    SELECT id INTO cat_seniores_id FROM categories WHERE code = 'SENIORES';

    -- Inserisci 4 ALLENATORI per categoria
    INSERT INTO profiles (id, first_name, last_name, role, birth_year, fir_code) VALUES
    -- U8 - 4 Allenatori
    (gen_random_uuid(), 'Marco', 'Rossi', 'allenatore', 1985, 'FIR-U8-COACH-001'),
    (gen_random_uuid(), 'Luca', 'Bianchi', 'allenatore', 1988, 'FIR-U8-COACH-002'),
    (gen_random_uuid(), 'Giuseppe', 'Verdi', 'allenatore', 1982, 'FIR-U8-COACH-003'),
    (gen_random_uuid(), 'Antonio', 'Neri', 'allenatore', 1990, 'FIR-U8-COACH-004'),

    -- U10 - 4 Allenatori
    (gen_random_uuid(), 'Roberto', 'Gialli', 'allenatore', 1987, 'FIR-U10-COACH-001'),
    (gen_random_uuid(), 'Paolo', 'Blu', 'allenatore', 1983, 'FIR-U10-COACH-002'),
    (gen_random_uuid(), 'Francesco', 'Rosa', 'allenatore', 1989, 'FIR-U10-COACH-003'),
    (gen_random_uuid(), 'Daniele', 'Viola', 'allenatore', 1986, 'FIR-U10-COACH-004'),

    -- U12 - 4 Allenatori
    (gen_random_uuid(), 'Alessandro', 'Arancioni', 'allenatore', 1984, 'FIR-U12-COACH-001'),
    (gen_random_uuid(), 'Matteo', 'Grigi', 'allenatore', 1991, 'FIR-U12-COACH-002'),
    (gen_random_uuid(), 'Davide', 'Marrone', 'allenatore', 1981, 'FIR-U12-COACH-003'),
    (gen_random_uuid(), 'Simone', 'Celesti', 'allenatore', 1988, 'FIR-U12-COACH-004'),

    -- U14 - 4 Allenatori
    (gen_random_uuid(), 'Federico', 'Gialli', 'allenatore', 1986, 'FIR-U14-COACH-001'),
    (gen_random_uuid(), 'Riccardo', 'Verdi', 'allenatore', 1983, 'FIR-U14-COACH-002'),
    (gen_random_uuid(), 'Emanuele', 'Rossi', 'allenatore', 1989, 'FIR-U14-COACH-003'),
    (gen_random_uuid(), 'Gabriele', 'Bianchi', 'allenatore', 1985, 'FIR-U14-COACH-004'),

    -- U16 - 4 Allenatori
    (gen_random_uuid(), 'Tommaso', 'Neri', 'allenatore', 1987, 'FIR-U16-COACH-001'),
    (gen_random_uuid(), 'Leonardo', 'Blu', 'allenatore', 1982, 'FIR-U16-COACH-002'),
    (gen_random_uuid(), 'Lorenzo', 'Rosa', 'allenatore', 1990, 'FIR-U16-COACH-003'),
    (gen_random_uuid(), 'Andrea', 'Viola', 'allenatore', 1984, 'FIR-U16-COACH-004'),

    -- U18 - 4 Allenatori
    (gen_random_uuid(), 'Stefano', 'Arancioni', 'allenatore', 1988, 'FIR-U18-COACH-001'),
    (gen_random_uuid(), 'Michele', 'Grigi', 'allenatore', 1983, 'FIR-U18-COACH-002'),
    (gen_random_uuid(), 'Cristian', 'Marrone', 'allenatore', 1989, 'FIR-U18-COACH-003'),
    (gen_random_uuid(), 'Fabio', 'Celesti', 'allenatore', 1986, 'FIR-U18-COACH-004'),

    -- Seniores - 4 Allenatori
    (gen_random_uuid(), 'Massimo', 'Gialli', 'allenatore', 1985, 'FIR-SEN-COACH-001'),
    (gen_random_uuid(), 'Giovanni', 'Verdi', 'allenatore', 1981, 'FIR-SEN-COACH-002'),
    (gen_random_uuid(), 'Alberto', 'Rossi', 'allenatore', 1987, 'FIR-SEN-COACH-003'),
    (gen_random_uuid(), 'Enrico', 'Bianchi', 'allenatore', 1984, 'FIR-SEN-COACH-004')
    ON CONFLICT (id) DO NOTHING;

    -- Inserisci 2 STAFF per categoria
    INSERT INTO profiles (id, first_name, last_name, role, birth_year, fir_code) VALUES
    -- U8 - 2 Staff
    (gen_random_uuid(), 'Carlo', 'Russo', 'staff', 1986, 'FIR-U8-STAFF-001'),
    (gen_random_uuid(), 'Domenico', 'Ferrari', 'staff', 1989, 'FIR-U8-STAFF-002'),

    -- U10 - 2 Staff
    (gen_random_uuid(), 'Vincenzo', 'Esposito', 'staff', 1984, 'FIR-U10-STAFF-001'),
    (gen_random_uuid(), 'Salvatore', 'Romano', 'staff', 1987, 'FIR-U10-STAFF-002'),

    -- U12 - 2 Staff
    (gen_random_uuid(), 'Angelo', 'Colombo', 'staff', 1988, 'FIR-U12-STAFF-001'),
    (gen_random_uuid(), 'Mario', 'Ricci', 'staff', 1983, 'FIR-U12-STAFF-002'),

    -- U14 - 2 Staff
    (gen_random_uuid(), 'Luigi', 'Marino', 'staff', 1985, 'FIR-U14-STAFF-001'),
    (gen_random_uuid(), 'Giuseppe', 'Greco', 'staff', 1990, 'FIR-U14-STAFF-002'),

    -- U16 - 2 Staff
    (gen_random_uuid(), 'Antonio', 'Rizzo', 'staff', 1986, 'FIR-U16-STAFF-001'),
    (gen_random_uuid(), 'Roberto', 'Lombardi', 'staff', 1982, 'FIR-U16-STAFF-002'),

    -- U18 - 2 Staff
    (gen_random_uuid(), 'Marco', 'Fontana', 'staff', 1987, 'FIR-U18-STAFF-001'),
    (gen_random_uuid(), 'Luca', 'Moretti', 'staff', 1989, 'FIR-U18-STAFF-002'),

    -- Seniores - 2 Staff
    (gen_random_uuid(), 'Paolo', 'Bruno', 'staff', 1984, 'FIR-SEN-STAFF-001'),
    (gen_random_uuid(), 'Francesco', 'Galli', 'staff', 1988, 'FIR-SEN-STAFF-002')
    ON CONFLICT (id) DO NOTHING;

    -- Inserisci 1 TEAM MANAGER per categoria
    INSERT INTO profiles (id, first_name, last_name, role, birth_year, fir_code) VALUES
    (gen_random_uuid(), 'Alberto', 'Conti', 'team_manager', 1983, 'FIR-U8-MGR-001'),
    (gen_random_uuid(), 'Emanuele', 'Costantini', 'team_manager', 1987, 'FIR-U10-MGR-001'),
    (gen_random_uuid(), 'Federico', 'Mancini', 'team_manager', 1985, 'FIR-U12-MGR-001'),
    (gen_random_uuid(), 'Riccardo', 'Valentini', 'team_manager', 1989, 'FIR-U14-MGR-001'),
    (gen_random_uuid(), 'Tommaso', 'Rinaldi', 'team_manager', 1986, 'FIR-U16-MGR-001'),
    (gen_random_uuid(), 'Leonardo', 'Amato', 'team_manager', 1982, 'FIR-U18-MGR-001'),
    (gen_random_uuid(), 'Lorenzo', 'Silvestri', 'team_manager', 1988, 'FIR-SEN-MGR-001')
    ON CONFLICT (id) DO NOTHING;

    -- Inserisci 2 ACCOMPAGNATORI per categoria
    INSERT INTO profiles (id, first_name, last_name, role, birth_year, fir_code) VALUES
    -- U8 - 2 Accompagnatori
    (gen_random_uuid(), 'Stefano', 'Cattaneo', 'accompagnatore', 1984, 'FIR-U8-ACC-001'),
    (gen_random_uuid(), 'Michele', 'Orlando', 'accompagnatore', 1987, 'FIR-U8-ACC-002'),

    -- U10 - 2 Accompagnatori
    (gen_random_uuid(), 'Cristian', 'Parisi', 'accompagnatore', 1986, 'FIR-U10-ACC-001'),
    (gen_random_uuid(), 'Fabio', 'Villa', 'accompagnatore', 1989, 'FIR-U10-ACC-002'),

    -- U12 - 2 Accompagnatori
    (gen_random_uuid(), 'Massimo', 'Ferrara', 'accompagnatore', 1983, 'FIR-U12-ACC-001'),
    (gen_random_uuid(), 'Giovanni', 'Sala', 'accompagnatore', 1988, 'FIR-U12-ACC-002'),

    -- U14 - 2 Accompagnatori
    (gen_random_uuid(), 'Alberto', 'Sanna', 'accompagnatore', 1985, 'FIR-U14-ACC-001'),
    (gen_random_uuid(), 'Enrico', 'Mazza', 'accompagnatore', 1990, 'FIR-U14-ACC-002'),

    -- U16 - 2 Accompagnatori
    (gen_random_uuid(), 'Roberto', 'Testa', 'accompagnatore', 1987, 'FIR-U16-ACC-001'),
    (gen_random_uuid(), 'Marco', 'Ferrari', 'accompagnatore', 1982, 'FIR-U16-ACC-002'),

    -- U18 - 2 Accompagnatori
    (gen_random_uuid(), 'Luca', 'Bianco', 'accompagnatore', 1986, 'FIR-U18-ACC-001'),
    (gen_random_uuid(), 'Paolo', 'Nero', 'accompagnatore', 1989, 'FIR-U18-ACC-002'),

    -- Seniores - 2 Accompagnatori
    (gen_random_uuid(), 'Francesco', 'Rosso', 'accompagnatore', 1984, 'FIR-SEN-ACC-001'),
    (gen_random_uuid(), 'Daniele', 'Verde', 'accompagnatore', 1988, 'FIR-SEN-ACC-002')
    ON CONFLICT (id) DO NOTHING;

    -- Ora collega tutti gli staff alle rispettive categorie
    -- Uso gli ID delle categorie recuperati sopra
    INSERT INTO staff_categories (user_id, category_id)
    SELECT p.id, c.id
    FROM profiles p
    CROSS JOIN categories c
    WHERE p.role IN ('allenatore', 'staff', 'team_manager', 'accompagnatore')
    AND (
        (p.fir_code LIKE 'FIR-U8-%' AND c.code = 'U8') OR
        (p.fir_code LIKE 'FIR-U10-%' AND c.code = 'U10') OR
        (p.fir_code LIKE 'FIR-U12-%' AND c.code = 'U12') OR
        (p.fir_code LIKE 'FIR-U14-%' AND c.code = 'U14') OR
        (p.fir_code LIKE 'FIR-U16-%' AND c.code = 'U16') OR
        (p.fir_code LIKE 'FIR-U18-%' AND c.code = 'U18') OR
        (p.fir_code LIKE 'FIR-SEN-%' AND c.code = 'SENIORES')
    )
    ON CONFLICT (user_id, category_id) DO NOTHING;

END $$;

-- Verifica i dati inseriti
SELECT 
  p.role,
  COUNT(*) as totale,
  STRING_AGG(DISTINCT c.code, ', ') as categorie
FROM profiles p
LEFT JOIN staff_categories sc ON p.id = sc.user_id
LEFT JOIN categories c ON sc.category_id = c.id
WHERE p.role IN ('allenatore', 'staff', 'team_manager', 'accompagnatore')
GROUP BY p.role
ORDER BY p.role;
