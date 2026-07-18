-- Fix RLS policies for events table - Aggiungi policy INSERT, UPDATE, DELETE
-- Esegui questo script nel database Supabase per permettere la creazione di eventi

-- Rimuovi policy INSERT, UPDATE, DELETE esistenti se presenti
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are insertable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are updatable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "Events are deletable by authenticated users" ON public.events;
DROP POLICY IF EXISTS "users_insert_events_policy" ON public.events;
DROP POLICY IF EXISTS "users_update_events_policy" ON public.events;
DROP POLICY IF EXISTS "users_delete_events_policy" ON public.events;

-- Crea policy INSERT per eventi
-- Permette a Admin, Dirigenti, Direttori e Staff di creare eventi
CREATE POLICY "users_insert_events_policy" ON public.events
FOR INSERT WITH CHECK (
  -- Admin e Dirigenti possono creare qualsiasi evento
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Staff/Allenatori possono creare eventi per le loro categorie
  (
    EXISTS (
      SELECT 1 FROM public.people staff
      WHERE staff.id = auth.uid()
      AND (
        -- Se category_id è NULL, permettono (eventi generali)
        events.category_id IS NULL
        OR
        -- Altrimenti devono avere accesso a quella categoria
        staff.staff_categories::jsonb ? events.category_id::text
      )
    )
  )
);

-- Crea policy UPDATE per eventi
-- Permette a Admin, Dirigenti, Direttori e Staff di modificare eventi
CREATE POLICY "users_update_events_policy" ON public.events
FOR UPDATE USING (
  -- Admin e Dirigenti possono modificare qualsiasi evento
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Staff/Allenatori possono modificare eventi delle loro categorie
  (
    EXISTS (
      SELECT 1 FROM public.people staff
      WHERE staff.id = auth.uid()
      AND (
        -- Se category_id è NULL, permettono (eventi generali)
        events.category_id IS NULL
        OR
        -- Altrimenti devono avere accesso a quella categoria
        staff.staff_categories::jsonb ? events.category_id::text
      )
    )
  )
);

-- Crea policy DELETE per eventi
-- Permette a Admin, Dirigenti, Direttori e Staff di eliminare eventi
CREATE POLICY "users_delete_events_policy" ON public.events
FOR DELETE USING (
  -- Admin e Dirigenti possono eliminare qualsiasi evento
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Staff/Allenatori possono eliminare eventi delle loro categorie
  (
    EXISTS (
      SELECT 1 FROM public.people staff
      WHERE staff.id = auth.uid()
      AND (
        -- Se category_id è NULL, permettono (eventi generali)
        events.category_id IS NULL
        OR
        -- Altrimenti devono avere accesso a quella categoria
        staff.staff_categories::jsonb ? events.category_id::text
      )
    )
  )
);

-- Verifica che RLS sia abilitato
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Messaggio di conferma
DO $$
BEGIN
  RAISE NOTICE '✅ Policy INSERT, UPDATE e DELETE per events create con successo!';
END $$;
