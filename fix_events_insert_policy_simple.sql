-- Fix RLS policies for events table - Versione semplificata
-- Esegui questo script nel database Supabase per permettere la creazione di eventi
-- Questa versione permette a tutti gli utenti autenticati di creare/modificare/eliminare eventi

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

-- Crea policy INSERT per eventi - Permette a tutti gli utenti autenticati
CREATE POLICY "users_insert_events_policy" ON public.events
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Crea policy UPDATE per eventi - Permette a tutti gli utenti autenticati
CREATE POLICY "users_update_events_policy" ON public.events
FOR UPDATE USING (auth.role() = 'authenticated');

-- Crea policy DELETE per eventi - Permette a tutti gli utenti autenticati
CREATE POLICY "users_delete_events_policy" ON public.events
FOR DELETE USING (auth.role() = 'authenticated');

-- Verifica che RLS sia abilitato
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Messaggio di conferma
DO $$
BEGIN
  RAISE NOTICE '✅ Policy INSERT, UPDATE e DELETE per events create con successo!';
  RAISE NOTICE 'Tutti gli utenti autenticati possono ora creare, modificare e eliminare eventi.';
END $$;
