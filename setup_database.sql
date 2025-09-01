-- Setup completo del database per l'app "Segna Presenze"
-- Esegui questo script in SQL Editor di Supabase

-- 1. Popola la tabella categories
INSERT INTO public.categories (id, code, name) VALUES
  (gen_random_uuid(), 'U14', 'Under 14'),
  (gen_random_uuid(), 'U16', 'Under 16'),
  (gen_random_uuid(), 'U18', 'Under 18'),
  (gen_random_uuid(), 'SENIORES', 'Seniores')
ON CONFLICT (code) DO NOTHING;

-- 2. Popola la tabella staff_categories (collega utente alle categorie)
-- Prima ottieni gli ID delle categorie
DO $$
DECLARE
  u14_id uuid;
  u16_id uuid;
  u18_id uuid;
  seniores_id uuid;
  user_id uuid;
BEGIN
  -- Ottieni gli ID delle categorie
  SELECT id INTO u14_id FROM categories WHERE code = 'U14';
  SELECT id INTO u16_id FROM categories WHERE code = 'U16';
  SELECT id INTO u18_id FROM categories WHERE code = 'U18';
  SELECT id INTO seniores_id FROM categories WHERE code = 'SENIORES';
  
  -- Ottieni l'ID dell'utente Andrea Bulgari
  SELECT id INTO user_id FROM profiles WHERE full_name = 'Andrea Bulgari';
  
  -- Inserisci le associazioni staff-categorie (Andrea Bulgari è admin di tutte)
  INSERT INTO public.staff_categories (user_id, category_id) VALUES
    (user_id, u14_id),
    (user_id, u16_id),
    (user_id, u18_id),
    (user_id, seniores_id)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Staff categories create per utente %', user_id;
END $$;

-- 3. Popola la tabella players con alcuni giocatori di esempio
INSERT INTO public.players (id, first_name, last_name, birth_year, injured, aggregated_seniores) VALUES
  (gen_random_uuid(), 'Marco', 'Rossi', 2008, false, false),
  (gen_random_uuid(), 'Luca', 'Bianchi', 2008, false, false),
  (gen_random_uuid(), 'Giovanni', 'Verdi', 2006, false, false),
  (gen_random_uuid(), 'Alessandro', 'Neri', 2006, false, false),
  (gen_random_uuid(), 'Matteo', 'Gialli', 2004, false, false),
  (gen_random_uuid(), 'Davide', 'Blu', 2004, false, false),
  (gen_random_uuid(), 'Roberto', 'Rosa', 1995, false, false),
  (gen_random_uuid(), 'Simone', 'Arancione', 1993, false, false)
ON CONFLICT DO NOTHING;

-- 4. Collega i giocatori alle categorie
DO $$
DECLARE
  u14_id uuid;
  u16_id uuid;
  u18_id uuid;
  seniores_id uuid;
  player_rec record;
BEGIN
  -- Ottieni gli ID delle categorie
  SELECT id INTO u14_id FROM categories WHERE code = 'U14';
  SELECT id INTO u16_id FROM categories WHERE code = 'U16';
  SELECT id INTO u18_id FROM categories WHERE code = 'U18';
  SELECT id INTO seniores_id FROM categories WHERE code = 'SENIORES';
  
  -- Collega giocatori U14 (nati 2008-2009)
  FOR player_rec IN SELECT id FROM players WHERE birth_year = 2008 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, u14_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Collega giocatori U16 (nati 2006-2007)
  FOR player_rec IN SELECT id FROM players WHERE birth_year = 2006 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, u16_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Collega giocatori U18 (nati 2004-2005)
  FOR player_rec IN SELECT id FROM players WHERE birth_year = 2004 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, u18_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Collega giocatori Seniores (nati 1990-2003)
  FOR player_rec IN SELECT id FROM players WHERE birth_year < 2004 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, seniores_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RAISE NOTICE 'Player categories create';
END $$;

-- 5. Verifica che tutto sia stato creato
SELECT 'Categories' as table_name, COUNT(*) as count FROM categories
UNION ALL
SELECT 'Staff Categories', COUNT(*) FROM staff_categories
UNION ALL
SELECT 'Players', COUNT(*) FROM players
UNION ALL
SELECT 'Player Categories', COUNT(*) FROM player_categories
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles;

