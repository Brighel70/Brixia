-- Script per configurare correttamente la tabella player_positions

-- 1. Verifica se la tabella player_positions esiste
DO $$
BEGIN
    -- Se la tabella non esiste, creala
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'player_positions') THEN
        CREATE TABLE player_positions (
            id uuid NOT NULL DEFAULT gen_random_uuid(),
            name text NOT NULL UNIQUE,
            position_order integer NOT NULL,
            created_at timestamp with time zone DEFAULT now(),
            CONSTRAINT player_positions_pkey PRIMARY KEY (id)
        );
        RAISE NOTICE 'Tabella player_positions creata';
    ELSE
        RAISE NOTICE 'Tabella player_positions già esiste';
    END IF;
END $$;

-- 2. Pulisci la tabella player_positions se ha dati
DELETE FROM player_positions;

-- 3. Inserisci le posizioni dei giocatori
INSERT INTO player_positions (name, position_order) VALUES
('Pilone DX', 1),
('Pilone SX', 2),
('Tallonatore', 3),
('Seconda Linea', 4),
('Terza Linea', 5),
('Mediano di Mischia', 6),
('Mediano d''Apertura', 7),
('Centro', 8),
('Ala', 9),
('Estremo', 10);

-- 4. Verifica i dati inseriti
SELECT 'Posizioni inserite:' as info, count(*) as count FROM player_positions;
SELECT id, name, position_order FROM player_positions ORDER BY position_order;



