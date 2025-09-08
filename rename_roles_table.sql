-- Script per rinominare la tabella roles in player_positions
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Rinomina la tabella roles in player_positions
ALTER TABLE public.roles RENAME TO player_positions;

-- 2. Aggiorna il nome della colonna nella tabella players
ALTER TABLE public.players RENAME COLUMN role_id TO position_id;

-- 3. Aggiorna la foreign key constraint
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_role_id_fkey;
ALTER TABLE public.players ADD CONSTRAINT players_position_id_fkey 
  FOREIGN KEY (position_id) REFERENCES public.player_positions(id);

-- 4. Verifica che tutto sia corretto
SELECT 'Tabella rinominata correttamente' as status;



