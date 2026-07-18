-- Permette notifiche per utenti FlowMe con invite code (senza auth.users)
-- Gli utenti con invite code non hanno profiles: usano person_id per ricevere notifiche

-- 1. Aggiungi person_id se non esiste (FlowMe migration potrebbe averlo già fatto)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES public.people(id);

-- 2. Rendi user_id nullable (per utenti invite code senza auth)
ALTER TABLE public.notifications
  ALTER COLUMN user_id DROP NOT NULL;

-- 3. Vincolo: almeno uno tra user_id e person_id deve essere valorizzato
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_or_person_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_or_person_check
  CHECK (user_id IS NOT NULL OR person_id IS NOT NULL);

-- 4. Indice per query per person_id
CREATE INDEX IF NOT EXISTS notifications_person_id_idx
  ON public.notifications(person_id) WHERE person_id IS NOT NULL;

-- 5. RLS: permettere lettura per utenti invite (person_id) - l'app FlowMe filtra per person_id
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR (person_id IS NOT NULL)
  );

-- 6. RLS UPDATE: permettere anche per person_id (mark as read)
DROP POLICY IF EXISTS "Users can update own notifications (mark read)" ON public.notifications;
CREATE POLICY "Users can update own notifications (mark read)" ON public.notifications
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (person_id IS NOT NULL)
  );

COMMENT ON COLUMN public.notifications.person_id IS 'Persona destinataria (FlowMe invite users); alternativo a user_id';
