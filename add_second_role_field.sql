-- Aggiungi un secondo campo per il ruolo in campo
ALTER TABLE public.players 
ADD COLUMN player_position_id_2 uuid REFERENCES public.player_positions(id);

-- Aggiungi un commento per spiegare i due campi
COMMENT ON COLUMN public.players.player_position_id IS 'Ruolo principale in campo';
COMMENT ON COLUMN public.players.player_position_id_2 IS 'Ruolo secondario in campo (opzionale)';




