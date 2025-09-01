-- Popola ogni categoria con 10 giocatori
-- Esegui questo script in SQL Editor di Supabase

-- 1. Prima rimuovi i giocatori esistenti per ricominciare pulito
DELETE FROM player_categories;
DELETE FROM players;

-- 2. Crea 10 giocatori per U14 (nati 2009-2010)
INSERT INTO public.players (id, first_name, last_name, birth_year, injured, aggregated_seniores) VALUES
  (gen_random_uuid(), 'Marco', 'Rossi', 2009, false, false),
  (gen_random_uuid(), 'Luca', 'Bianchi', 2009, false, false),
  (gen_random_uuid(), 'Giovanni', 'Verdi', 2009, false, false),
  (gen_random_uuid(), 'Alessandro', 'Neri', 2009, false, false),
  (gen_random_uuid(), 'Matteo', 'Gialli', 2009, false, false),
  (gen_random_uuid(), 'Davide', 'Blu', 2009, false, false),
  (gen_random_uuid(), 'Roberto', 'Rosa', 2009, false, false),
  (gen_random_uuid(), 'Simone', 'Arancione', 2009, false, false),
  (gen_random_uuid(), 'Federico', 'Viola', 2009, false, false),
  (gen_random_uuid(), 'Riccardo', 'Marrone', 2009, false, false);

-- 3. Crea 10 giocatori per U16 (nati 2007-2008)
INSERT INTO public.players (id, first_name, last_name, birth_year, injured, aggregated_seniores) VALUES
  (gen_random_uuid(), 'Antonio', 'Ferrari', 2007, false, false),
  (gen_random_uuid(), 'Giuseppe', 'Russo', 2007, false, false),
  (gen_random_uuid(), 'Francesco', 'Colombo', 2007, false, false),
  (gen_random_uuid(), 'Angelo', 'Ricci', 2007, false, false),
  (gen_random_uuid(), 'Vincenzo', 'Marino', 2007, false, false),
  (gen_random_uuid(), 'Salvatore', 'Greco', 2007, false, false),
  (gen_random_uuid(), 'Domenico', 'Rizzo', 2007, false, false),
  (gen_random_uuid(), 'Alberto', 'Lombardi', 2007, false, false),
  (gen_random_uuid(), 'Massimo', 'Fontana', 2007, false, false),
  (gen_random_uuid(), 'Emanuele', 'Costa', 2007, false, false);

-- 4. Crea 10 giocatori per U18 (nati 2005-2006)
INSERT INTO public.players (id, first_name, last_name, birth_year, injured, aggregated_seniores) VALUES
  (gen_random_uuid(), 'Cristian', 'Mancini', 2005, false, false),
  (gen_random_uuid(), 'Daniele', 'Longo', 2005, false, false),
  (gen_random_uuid(), 'Gabriele', 'Leone', 2005, false, false),
  (gen_random_uuid(), 'Samuele', 'Martinelli', 2005, false, false),
  (gen_random_uuid(), 'Tommaso', 'Rinaldi', 2005, false, false),
  (gen_random_uuid(), 'Nicolò', 'Caruso', 2005, false, false),
  (gen_random_uuid(), 'Leonardo', 'Ferrara', 2005, false, false),
  (gen_random_uuid(), 'Alessio', 'Galli', 2005, false, false),
  (gen_random_uuid(), 'Filippo', 'Conti', 2005, false, false),
  (gen_random_uuid(), 'Lorenzo', 'Esposito', 2005, false, false);

-- 5. Crea 10 giocatori per SENIORES (nati 1990-2004)
INSERT INTO public.players (id, first_name, last_name, birth_year, injured, aggregated_seniores) VALUES
  (gen_random_uuid(), 'Andrea', 'Romano', 1995, false, false),
  (gen_random_uuid(), 'Paolo', 'Galli', 1993, false, false),
  (gen_random_uuid(), 'Stefano', 'Ferrari', 1991, false, false),
  (gen_random_uuid(), 'Roberto', 'Bianchi', 1989, false, false),
  (gen_random_uuid(), 'Marco', 'Neri', 1992, false, false),
  (gen_random_uuid(), 'Luca', 'Verdi', 1994, false, false),
  (gen_random_uuid(), 'Giovanni', 'Rossi', 1990, false, false),
  (gen_random_uuid(), 'Alessandro', 'Mancini', 1996, false, false),
  (gen_random_uuid(), 'Matteo', 'Longo', 1997, false, false),
  (gen_random_uuid(), 'Davide', 'Leone', 1998, false, false);

-- 6. Collega tutti i giocatori alle rispettive categorie
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
  
  -- Collega giocatori U14 (nati 2009)
  FOR player_rec IN SELECT id FROM players WHERE birth_year = 2009 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, u14_id);
  END LOOP;
  
  -- Collega giocatori U16 (nati 2007)
  FOR player_rec IN SELECT id FROM players WHERE birth_year = 2007 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, u16_id);
  END LOOP;
  
  -- Collega giocatori U18 (nati 2005)
  FOR player_rec IN SELECT id FROM players WHERE birth_year = 2005 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, u18_id);
  END LOOP;
  
  -- Collega giocatori Seniores (nati 1989-1998)
  FOR player_rec IN SELECT id FROM players WHERE birth_year < 2005 LOOP
    INSERT INTO public.player_categories (player_id, category_id) VALUES
      (player_rec.id, seniores_id);
  END LOOP;
  
  RAISE NOTICE 'Tutti i giocatori collegati alle categorie!';
END $$;

-- 7. Verifica il risultato
SELECT 
  c.code as categoria,
  COUNT(pc.player_id) as numero_giocatori
FROM categories c
LEFT JOIN player_categories pc ON c.id = pc.category_id
GROUP BY c.code, c.id
ORDER BY c.code;

