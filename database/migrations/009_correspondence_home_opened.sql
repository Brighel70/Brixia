-- =============================================================================
-- 009_correspondence_home_opened.sql
-- Tiene traccia dei thread aperti nella card Messaggi (home).
-- Se arriva un nuovo messaggio dopo opened_at → riga di nuovo "non letto" (verde).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.correspondence_home_opened (
  thread_id uuid PRIMARY KEY
    REFERENCES public.correspondence_threads(id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.correspondence_home_opened ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS corr_home_opened_select ON public.correspondence_home_opened;
CREATE POLICY corr_home_opened_select ON public.correspondence_home_opened
  FOR SELECT TO authenticated
  USING (public.is_society_staff());

DROP POLICY IF EXISTS corr_home_opened_insert ON public.correspondence_home_opened;
CREATE POLICY corr_home_opened_insert ON public.correspondence_home_opened
  FOR INSERT TO authenticated
  WITH CHECK (public.is_society_staff());

DROP POLICY IF EXISTS corr_home_opened_update ON public.correspondence_home_opened;
CREATE POLICY corr_home_opened_update ON public.correspondence_home_opened
  FOR UPDATE TO authenticated
  USING (public.is_society_staff())
  WITH CHECK (public.is_society_staff());

DROP POLICY IF EXISTS corr_home_opened_delete ON public.correspondence_home_opened;
CREATE POLICY corr_home_opened_delete ON public.correspondence_home_opened
  FOR DELETE TO authenticated
  USING (public.is_society_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.correspondence_home_opened TO authenticated;
GRANT ALL ON public.correspondence_home_opened TO service_role;

NOTIFY pgrst, 'reload schema';
