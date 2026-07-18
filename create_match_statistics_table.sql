-- =====================================================
-- CREAZIONE TABELLA match_statistics
-- =====================================================

-- Crea la tabella match_statistics per gestire le statistiche dei giocatori durante le partite
CREATE TABLE IF NOT EXISTS public.match_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_list_id UUID NOT NULL REFERENCES public.match_lists(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    
    -- Statistiche offensive
    tries INTEGER DEFAULT 0, -- Mete segnate
    try_minutes INTEGER[], -- Minuti in cui sono state segnate le mete
    conversions INTEGER DEFAULT 0, -- Trasformazioni fatte
    conversion_minutes INTEGER[], -- Minuti in cui sono state fatte le trasformazioni
    drop_goals INTEGER DEFAULT 0, -- Piazzati segnati
    drop_goal_minutes INTEGER[], -- Minuti in cui sono stati segnati i piazzati
    
    -- Statistiche difensive
    tries_conceded INTEGER DEFAULT 0, -- Mete subite (per statistiche squadra)
    drop_goals_conceded INTEGER DEFAULT 0, -- Piazzati subiti (per statistiche squadra)
    
    -- Cartellini
    yellow_cards INTEGER DEFAULT 0,
    yellow_card_minutes INTEGER[], -- Minuti in cui sono stati dati i cartellini gialli
    red_cards INTEGER DEFAULT 0,
    red_card_minutes INTEGER[], -- Minuti in cui sono stati dati i cartellini rossi
    
    -- Sostituzioni
    substitution_in_minute INTEGER, -- Minuto in cui è entrato in campo (se è stato sostituito)
    substitution_out_minute INTEGER, -- Minuto in cui è uscito dal campo (se è stato sostituito)
    substituted_by_player_id UUID REFERENCES public.people(id), -- Giocatore che lo ha sostituito
    
    -- Minuti giocati
    minutes_played INTEGER DEFAULT 0, -- Minuti totali giocati
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Vincolo univoco: un giocatore può avere solo una riga di statistiche per match_list
    UNIQUE(match_list_id, player_id)
);

-- Crea indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_match_statistics_match_list_id ON public.match_statistics(match_list_id);
CREATE INDEX IF NOT EXISTS idx_match_statistics_player_id ON public.match_statistics(player_id);
CREATE INDEX IF NOT EXISTS idx_match_statistics_event_id ON public.match_statistics(event_id);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_match_statistics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_statistics_updated_at
    BEFORE UPDATE ON public.match_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_match_statistics_updated_at();

-- Abilita RLS (Row Level Security)
ALTER TABLE public.match_statistics ENABLE ROW LEVEL SECURITY;

-- Crea policy per permettere agli utenti di vedere le statistiche delle loro categorie
CREATE POLICY "Users can view match statistics for their categories" ON public.match_statistics
    FOR SELECT USING (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

-- Crea policy per permettere agli utenti di inserire statistiche per le loro categorie
CREATE POLICY "Users can insert match statistics for their categories" ON public.match_statistics
    FOR INSERT WITH CHECK (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

-- Crea policy per permettere agli utenti di aggiornare statistiche per le loro categorie
CREATE POLICY "Users can update match statistics for their categories" ON public.match_statistics
    FOR UPDATE USING (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

-- Crea policy per permettere agli utenti di eliminare statistiche per le loro categorie
CREATE POLICY "Users can delete match statistics for their categories" ON public.match_statistics
    FOR DELETE USING (
        match_list_id IN (
            SELECT id FROM public.match_lists
            WHERE category_id IN (
                SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
                WHERE id = auth.uid() AND staff_categories IS NOT NULL
            )
        )
    );

-- Aggiungi commenti per documentazione
COMMENT ON TABLE public.match_statistics IS 'Statistiche dei giocatori durante le partite';
COMMENT ON COLUMN public.match_statistics.match_list_id IS 'ID della lista gara associata';
COMMENT ON COLUMN public.match_statistics.player_id IS 'ID del giocatore';
COMMENT ON COLUMN public.match_statistics.event_id IS 'ID dell''evento (partita) associato';
COMMENT ON COLUMN public.match_statistics.tries IS 'Numero di mete segnate';
COMMENT ON COLUMN public.match_statistics.try_minutes IS 'Array dei minuti in cui sono state segnate le mete';
COMMENT ON COLUMN public.match_statistics.conversions IS 'Numero di trasformazioni fatte';
COMMENT ON COLUMN public.match_statistics.conversion_minutes IS 'Array dei minuti in cui sono state fatte le trasformazioni';
COMMENT ON COLUMN public.match_statistics.drop_goals IS 'Numero di piazzati segnati';
COMMENT ON COLUMN public.match_statistics.drop_goal_minutes IS 'Array dei minuti in cui sono stati segnati i piazzati';
COMMENT ON COLUMN public.match_statistics.yellow_cards IS 'Numero di cartellini gialli';
COMMENT ON COLUMN public.match_statistics.red_cards IS 'Numero di cartellini rossi';
COMMENT ON COLUMN public.match_statistics.substitution_in_minute IS 'Minuto in cui il giocatore è entrato in campo';
COMMENT ON COLUMN public.match_statistics.substitution_out_minute IS 'Minuto in cui il giocatore è uscito dal campo';
COMMENT ON COLUMN public.match_statistics.minutes_played IS 'Minuti totali giocati';

-- =====================================================
-- FINE SCRIPT
-- =====================================================
