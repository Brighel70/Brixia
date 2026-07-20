-- =============================================================================
-- 008_correspondence_home_hidden.sql
-- Nasconde messaggi dalla card "Messaggi" in home TeamFlow.
-- NON cancella i messaggi: restano in anagrafica / Corrispondenza.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.correspondence_home_hidden (
  message_id uuid PRIMARY KEY
    REFERENCES public.correspondence_messages(id) ON DELETE CASCADE,
  hidden_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'dismissed'
    CHECK (reason IN ('dismissed', 'replied'))
);

CREATE INDEX IF NOT EXISTS idx_corr_home_hidden_at
  ON public.correspondence_home_hidden (hidden_at DESC);

ALTER TABLE public.correspondence_home_hidden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corr_home_hidden_select ON public.correspondence_home_hidden;
CREATE POLICY corr_home_hidden_select ON public.correspondence_home_hidden
  FOR SELECT TO authenticated
  USING (public.is_society_staff());

DROP POLICY IF EXISTS corr_home_hidden_insert ON public.correspondence_home_hidden;
CREATE POLICY corr_home_hidden_insert ON public.correspondence_home_hidden
  FOR INSERT TO authenticated
  WITH CHECK (public.is_society_staff());

DROP POLICY IF EXISTS corr_home_hidden_delete ON public.correspondence_home_hidden;
CREATE POLICY corr_home_hidden_delete ON public.correspondence_home_hidden
  FOR DELETE TO authenticated
  USING (public.is_society_staff());

GRANT SELECT, INSERT, DELETE ON public.correspondence_home_hidden TO authenticated;
GRANT ALL ON public.correspondence_home_hidden TO service_role;

NOTIFY pgrst, 'reload schema';
