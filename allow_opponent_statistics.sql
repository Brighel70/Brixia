-- =====================================================
-- MODIFICA TABELLA match_statistics PER SUPPORTARE AVVERSARIO
-- =====================================================

-- 1. Rimuovi il vincolo NOT NULL da player_id
ALTER TABLE public.match_statistics
    ALTER COLUMN player_id DROP NOT NULL;

-- 2. Rimuovi il vincolo di foreign key (perché non possiamo avere FK verso NULL)
-- Prima rimuoviamo il vincolo esistente
ALTER TABLE public.match_statistics
    DROP CONSTRAINT IF EXISTS match_statistics_player_id_fkey;

-- 3. Ricrea il vincolo di foreign key ma solo quando player_id non è NULL
-- Nota: PostgreSQL non supporta direttamente foreign key condizionali,
-- quindi usiamo un approccio alternativo: manteniamo il vincolo ma permettiamo NULL
ALTER TABLE public.match_statistics
    ADD CONSTRAINT match_statistics_player_id_fkey
    FOREIGN KEY (player_id) 
    REFERENCES public.people(id) 
    ON DELETE CASCADE;

-- 4. Modifica il vincolo UNIQUE per permettere più righe con player_id NULL
-- (una per match_list_id quando player_id è NULL per l'avversario)
-- Prima rimuoviamo il vincolo esistente
ALTER TABLE public.match_statistics
    DROP CONSTRAINT IF EXISTS match_statistics_match_list_id_player_id_key;

-- 5. Ricrea il vincolo UNIQUE che permette NULL
-- PostgreSQL tratta NULL come valori distinti nel vincolo UNIQUE,
-- quindi possiamo avere solo una riga con (match_list_id, NULL)
CREATE UNIQUE INDEX IF NOT EXISTS match_statistics_match_list_player_unique
    ON public.match_statistics(match_list_id, player_id)
    WHERE player_id IS NOT NULL;

-- Per l'avversario (player_id NULL), permettiamo solo una riga per match_list_id
CREATE UNIQUE INDEX IF NOT EXISTS match_statistics_match_list_opponent_unique
    ON public.match_statistics(match_list_id)
    WHERE player_id IS NULL;

-- 6. Aggiorna i commenti
COMMENT ON COLUMN public.match_statistics.player_id IS 'ID del giocatore (NULL per statistiche avversario)';

-- =====================================================
-- FINE SCRIPT
-- =====================================================
