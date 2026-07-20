-- =============================================================================
-- 006_correspondence.sql
-- Chat a thread (Corrispondenza) — messaggi manuali con titolo e risposte.
-- Le notifiche automatiche restano in public.notifications (non rispondibili).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.correspondence_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  created_by_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_by_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'teamflow'
    CHECK (origin IN ('teamflow', 'flowme')),
  -- true = la società (TeamFlow) è parte della conversazione / destinatario HQ
  to_society boolean NOT NULL DEFAULT false,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corr_threads_last_msg
  ON public.correspondence_threads (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_corr_threads_society
  ON public.correspondence_threads (to_society)
  WHERE to_society = true;

CREATE TABLE IF NOT EXISTS public.correspondence_participants (
  thread_id uuid NOT NULL REFERENCES public.correspondence_threads(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_corr_participants_person
  ON public.correspondence_participants (person_id);

CREATE TABLE IF NOT EXISTS public.correspondence_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.correspondence_threads(id) ON DELETE CASCADE,
  sender_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  sender_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- true = inviato come "Società" da TeamFlow (segreteria/admin)
  from_society boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT correspondence_messages_body_not_empty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_corr_messages_thread
  ON public.correspondence_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.correspondence_reads (
  thread_id uuid NOT NULL REFERENCES public.correspondence_threads(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, person_id)
);

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(trim(coalesce(role, ''))) = 'admin'
  );
$$;

-- Staff HQ TeamFlow: Admin / Segreteria / Dirigente
CREATE OR REPLACE FUNCTION public.is_society_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(trim(coalesce(role, ''))) IN ('admin', 'segreteria', 'dirigente')
  );
$$;

REVOKE ALL ON FUNCTION public.is_society_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_society_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_society_staff() TO service_role;

CREATE OR REPLACE FUNCTION public.is_correspondence_participant(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_society_staff()
    OR EXISTS (
      SELECT 1
      FROM public.correspondence_participants cp
      WHERE cp.thread_id = p_thread_id
        AND cp.person_id = public.get_my_person_id()
    )
    OR EXISTS (
      SELECT 1
      FROM public.correspondence_threads t
      WHERE t.id = p_thread_id
        AND t.to_society = true
        AND public.is_society_staff()
    );
$$;

REVOKE ALL ON FUNCTION public.is_correspondence_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_correspondence_participant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_correspondence_participant(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.correspondence_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correspondence_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correspondence_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correspondence_reads ENABLE ROW LEVEL SECURITY;

SELECT public._drop_all_policies('public', 'correspondence_threads');
SELECT public._drop_all_policies('public', 'correspondence_participants');
SELECT public._drop_all_policies('public', 'correspondence_messages');
SELECT public._drop_all_policies('public', 'correspondence_reads');

CREATE POLICY corr_threads_select ON public.correspondence_threads
  FOR SELECT TO authenticated
  USING (
    public.is_society_staff()
    OR id IN (
      SELECT thread_id FROM public.correspondence_participants
      WHERE person_id = public.get_my_person_id()
    )
    OR created_by_auth_id = auth.uid()
  );

CREATE POLICY corr_threads_insert ON public.correspondence_threads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY corr_threads_update ON public.correspondence_threads
  FOR UPDATE TO authenticated
  USING (public.is_correspondence_participant(id) OR created_by_auth_id = auth.uid())
  WITH CHECK (public.is_correspondence_participant(id) OR created_by_auth_id = auth.uid());

-- PARTICIPANTS
CREATE POLICY corr_participants_select ON public.correspondence_participants
  FOR SELECT TO authenticated
  USING (public.is_correspondence_participant(thread_id));

CREATE POLICY corr_participants_insert ON public.correspondence_participants
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY corr_participants_delete ON public.correspondence_participants
  FOR DELETE TO authenticated
  USING (public.is_society_staff());

-- MESSAGES
CREATE POLICY corr_messages_select ON public.correspondence_messages
  FOR SELECT TO authenticated
  USING (public.is_correspondence_participant(thread_id));

CREATE POLICY corr_messages_insert ON public.correspondence_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_correspondence_participant(thread_id));

-- READS
CREATE POLICY corr_reads_select ON public.correspondence_reads
  FOR SELECT TO authenticated
  USING (
    person_id = public.get_my_person_id()
    OR public.is_society_staff()
  );

CREATE POLICY corr_reads_upsert ON public.correspondence_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    person_id = public.get_my_person_id()
    OR public.is_society_staff()
  );

CREATE POLICY corr_reads_update ON public.correspondence_reads
  FOR UPDATE TO authenticated
  USING (
    person_id = public.get_my_person_id()
    OR public.is_society_staff()
  )
  WITH CHECK (
    person_id = public.get_my_person_id()
    OR public.is_society_staff()
  );

NOTIFY pgrst, 'reload schema';
