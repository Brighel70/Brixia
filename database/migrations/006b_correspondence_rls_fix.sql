-- =============================================================================
-- 006b_correspondence_rls_fix.sql
-- Fix: GRANT + policy INSERT (errore "violates row-level security policy")
-- Esegui in Supabase SQL Editor dopo 006.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.correspondence_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.correspondence_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.correspondence_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.correspondence_reads TO authenticated;

DROP POLICY IF EXISTS corr_threads_insert ON public.correspondence_threads;
CREATE POLICY corr_threads_insert ON public.correspondence_threads
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS corr_participants_insert ON public.correspondence_participants;
CREATE POLICY corr_participants_insert ON public.correspondence_participants
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS corr_messages_insert ON public.correspondence_messages;
CREATE POLICY corr_messages_insert ON public.correspondence_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_correspondence_participant(thread_id)
    OR public.is_society_staff()
    OR EXISTS (
      SELECT 1 FROM public.correspondence_threads t
      WHERE t.id = thread_id AND t.created_by_auth_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
