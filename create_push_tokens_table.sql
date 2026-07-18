-- =====================================================
-- TABELLA TOKEN PUSH (FCM) PER NOTIFICHE CON APP CHIUSA/BACKGROUND
-- =====================================================
-- L'app mobile registra qui il token FCM (Firebase Cloud Messaging) dell'utente.
-- Un Edge Function o backend, quando inserisce una riga in notifications, invia
-- anche una push reale a FCM così la notifica arriva anche con app chiusa/in background.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT, -- 'android' | 'ios' | 'web'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- L'utente può inserire/aggiornare/eliminare solo i propri token
DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role (Edge Function) deve poter leggere token per user_id per inviare push
-- Le Edge Function usano service_role, quindi bypassano RLS quando necessario.

COMMENT ON TABLE public.push_tokens IS 'Token FCM per invio push quando app è chiusa o in background';
