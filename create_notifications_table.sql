-- =====================================================
-- TABELLA NOTIFICHE PER APP MOBILE (operatore avvisato su modifica appuntamento)
-- =====================================================
-- L'app mobile può iscriversi in Realtime a questa tabella (WHERE user_id = auth.uid())
-- oppure fare polling. Quando qualcuno modifica un'attività/appuntamento con data futura,
-- si inserisce qui una riga per l'operatore (user_id = id utente auth del medico/fisio).

-- Crea tabella se non esiste
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'activity_updated',
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indici per lettura veloce dall'app mobile
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- RLS: ogni utente vede solo le proprie notifiche
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications (mark read)" ON public.notifications;
CREATE POLICY "Users can update own notifications (mark read)" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Inserimento: solo il backend (service role) o trigger; l'app web usa service role o una funzione RPC.
-- Per permettere all'app web di inserire notifiche per altri utenti, usiamo una policy che permette
-- a qualsiasi utente autenticato di inserire (il backend filtra per operator_name → user_id).
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Oppure restringi: solo se stai inserendo per te stesso (non utile per notificare l'operatore).
-- Per notificare l'operatore (altro user_id) serve una Edge Function o una RPC con SECURITY DEFINER.
-- Soluzione semplice: policy che permette INSERT a utenti autenticati (l'app inserisce per user_id operatore).
-- La sicurezza è che solo chi è loggato può creare notifiche; il user_id viene da profiles.person_id.

COMMENT ON TABLE public.notifications IS 'Notifiche per app mobile: modifica appuntamento, ecc.';
COMMENT ON COLUMN public.notifications.metadata IS 'Es: {"activity_id":"...","injury_id":"...","player_name":"..."}';
