-- =====================================================
-- CREAZIONE TABELLA match_lists
-- =====================================================

-- Crea la tabella match_lists per gestire le liste gara
CREATE TABLE IF NOT EXISTS public.match_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('match', 'friendly', 'training')),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    selected_players JSONB NOT NULL DEFAULT '[]'::jsonb,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crea indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_match_lists_category_id ON public.match_lists(category_id);
CREATE INDEX IF NOT EXISTS idx_match_lists_created_by ON public.match_lists(created_by);
CREATE INDEX IF NOT EXISTS idx_match_lists_type ON public.match_lists(type);
CREATE INDEX IF NOT EXISTS idx_match_lists_created_at ON public.match_lists(created_at);

-- Abilita RLS (Row Level Security)
ALTER TABLE public.match_lists ENABLE ROW LEVEL SECURITY;

-- Elimina le policy esistenti se presenti (per rendere lo script idempotente)
DROP POLICY IF EXISTS "Users can view match lists for their categories" ON public.match_lists;
DROP POLICY IF EXISTS "Users can insert match lists for their categories" ON public.match_lists;
DROP POLICY IF EXISTS "Users can update their own match lists" ON public.match_lists;
DROP POLICY IF EXISTS "Users can delete their own match lists" ON public.match_lists;

-- Crea policy per permettere agli utenti di vedere solo le liste delle loro categorie
-- Permette visualizzazione se l'utente ha staff_categories in people con id = auth.uid() O id = profile.person_id
CREATE POLICY "Users can view match lists for their categories" ON public.match_lists
    FOR SELECT USING (
        category_id IN (
            SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
            WHERE (
                id = auth.uid() 
                OR id IN (
                    SELECT person_id FROM public.profiles WHERE id = auth.uid() AND person_id IS NOT NULL
                )
            ) AND staff_categories IS NOT NULL
        )
    );

-- Crea policy per permettere agli utenti di inserire liste per le loro categorie
-- Permette created_by = auth.uid() O created_by = profile.person_id dell'utente autenticato
CREATE POLICY "Users can insert match lists for their categories" ON public.match_lists
    FOR INSERT WITH CHECK (
        category_id IN (
            SELECT jsonb_array_elements_text(staff_categories)::uuid FROM public.people 
            WHERE (id = auth.uid() OR id IN (
                SELECT person_id FROM public.profiles WHERE id = auth.uid() AND person_id IS NOT NULL
            )) AND staff_categories IS NOT NULL
        ) AND (
            created_by = auth.uid() 
            OR created_by IN (
                SELECT person_id FROM public.profiles WHERE id = auth.uid() AND person_id IS NOT NULL
            )
        )
    );

-- Crea policy per permettere agli utenti di aggiornare le loro liste
-- Permette aggiornamento se created_by = auth.uid() O created_by = profile.person_id
CREATE POLICY "Users can update their own match lists" ON public.match_lists
    FOR UPDATE USING (
        created_by = auth.uid() 
        OR created_by IN (
            SELECT person_id FROM public.profiles WHERE id = auth.uid() AND person_id IS NOT NULL
        )
    );

-- Crea policy per permettere agli utenti di eliminare le loro liste
-- Permette eliminazione se created_by = auth.uid() O created_by = profile.person_id
CREATE POLICY "Users can delete their own match lists" ON public.match_lists
    FOR DELETE USING (
        created_by = auth.uid() 
        OR created_by IN (
            SELECT person_id FROM public.profiles WHERE id = auth.uid() AND person_id IS NOT NULL
        )
    );

-- Aggiungi commenti per documentazione
COMMENT ON TABLE public.match_lists IS 'Tabelle per gestire le liste gara delle squadre';
COMMENT ON COLUMN public.match_lists.name IS 'Nome della lista gara';
COMMENT ON COLUMN public.match_lists.type IS 'Tipo di lista: match, friendly, training';
COMMENT ON COLUMN public.match_lists.category_id IS 'ID della categoria per cui è creata la lista';
COMMENT ON COLUMN public.match_lists.selected_players IS 'Array JSON con i giocatori selezionati e i loro numeri';
COMMENT ON COLUMN public.match_lists.event_id IS 'ID dell''evento associato (opzionale)';
COMMENT ON COLUMN public.match_lists.created_by IS 'ID dell''utente che ha creato la lista';

-- =====================================================
-- FINE SCRIPT
-- =====================================================
