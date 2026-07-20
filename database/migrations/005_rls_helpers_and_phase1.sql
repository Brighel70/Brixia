-- =============================================================================
-- 005_rls_helpers_and_phase1.sql
-- =============================================================================
-- Fase 0: helper identità (auth.uid → profiles.person_id)
-- Fase 1: chiude le policy aperte sulle tabelle "own-row" / basse (push, notifiche,
--         promemoria). NON tocca people / fees / documents / injuries / events.
--
-- Prerequisito app: FlowMe e TeamFlow con sessione Auth persistente.
-- Esegui in Supabase → SQL Editor (progetto condiviso). service_role bypassa RLS
-- (Edge Function continue a funzionare).
--
-- Dopo l'esecuzione: gli utenti devono essere loggati (JWT). Anon non scrive più
-- su push_subscriptions / notifications.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- FASE 0 — Helper
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT person_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_person_id() IS
  'people.id collegato al JWT corrente via profiles.person_id';

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

COMMENT ON FUNCTION public.is_app_admin() IS
  'True se profiles.role = Admin (include admin assistenza)';

REVOKE ALL ON FUNCTION public.get_my_person_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_person_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
-- service_role ha comunque bypass; grant esplicito per chiarezza
GRANT EXECUTE ON FUNCTION public.get_my_person_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO service_role;

-- -----------------------------------------------------------------------------
-- Utility: drop tutte le policy di una tabella
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._drop_all_policies(p_schema text, p_table text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = p_schema AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, p_schema, p_table);
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- FASE 1a — push_subscriptions (person_id = me | admin)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.push_subscriptions') IS NULL THEN
    RAISE NOTICE '005: skip push_subscriptions (tabella assente)';
    RETURN;
  END IF;

  ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
  PERFORM public._drop_all_policies('public', 'push_subscriptions');

  CREATE POLICY push_subscriptions_select_own
    ON public.push_subscriptions FOR SELECT TO authenticated
    USING (person_id = public.get_my_person_id() OR public.is_app_admin());

  CREATE POLICY push_subscriptions_insert_own
    ON public.push_subscriptions FOR INSERT TO authenticated
    WITH CHECK (person_id = public.get_my_person_id() OR public.is_app_admin());

  CREATE POLICY push_subscriptions_update_own
    ON public.push_subscriptions FOR UPDATE TO authenticated
    USING (person_id = public.get_my_person_id() OR public.is_app_admin())
    WITH CHECK (person_id = public.get_my_person_id() OR public.is_app_admin());

  CREATE POLICY push_subscriptions_delete_own
    ON public.push_subscriptions FOR DELETE TO authenticated
    USING (person_id = public.get_my_person_id() OR public.is_app_admin());

  RAISE NOTICE '005: push_subscriptions policies OK';
END $$;

-- -----------------------------------------------------------------------------
-- FASE 1b — push_tokens (user_id = auth.uid | admin)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.push_tokens') IS NULL THEN
    RAISE NOTICE '005: skip push_tokens (tabella assente)';
    RETURN;
  END IF;

  ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
  PERFORM public._drop_all_policies('public', 'push_tokens');

  CREATE POLICY push_tokens_select_own
    ON public.push_tokens FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_app_admin());

  CREATE POLICY push_tokens_insert_own
    ON public.push_tokens FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

  CREATE POLICY push_tokens_update_own
    ON public.push_tokens FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_app_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_app_admin());

  CREATE POLICY push_tokens_delete_own
    ON public.push_tokens FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR public.is_app_admin());

  RAISE NOTICE '005: push_tokens policies OK';
END $$;

-- -----------------------------------------------------------------------------
-- FASE 1c — notifications (proprie | admin)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE NOTICE '005: skip notifications (tabella assente)';
    RETURN;
  END IF;

  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  PERFORM public._drop_all_policies('public', 'notifications');

  CREATE POLICY notifications_select_own
    ON public.notifications FOR SELECT TO authenticated
    USING (
      public.is_app_admin()
      OR user_id = auth.uid()
      OR person_id = public.get_my_person_id()
    );

  -- Staff/TeamFlow devono poter creare notifiche per altri destinatari
  CREATE POLICY notifications_insert_authenticated
    ON public.notifications FOR INSERT TO authenticated
    WITH CHECK (true);

  CREATE POLICY notifications_update_own
    ON public.notifications FOR UPDATE TO authenticated
    USING (
      public.is_app_admin()
      OR user_id = auth.uid()
      OR person_id = public.get_my_person_id()
    )
    WITH CHECK (
      public.is_app_admin()
      OR user_id = auth.uid()
      OR person_id = public.get_my_person_id()
    );

  CREATE POLICY notifications_delete_own
    ON public.notifications FOR DELETE TO authenticated
    USING (
      public.is_app_admin()
      OR user_id = auth.uid()
      OR person_id = public.get_my_person_id()
    );

  RAISE NOTICE '005: notifications policies OK';
END $$;

-- -----------------------------------------------------------------------------
-- FASE 1d — injury_reminders (pubblico | creatore | admin); solo authenticated
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.injury_reminders') IS NULL THEN
    RAISE NOTICE '005: skip injury_reminders (tabella assente)';
    RETURN;
  END IF;

  -- colonne opzionali se manca migrazione add_reminder_public_private
  BEGIN
    ALTER TABLE public.injury_reminders
      ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.injury_reminders
      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
  EXCEPTION WHEN others THEN NULL;
  END;

  ALTER TABLE public.injury_reminders ENABLE ROW LEVEL SECURITY;
  PERFORM public._drop_all_policies('public', 'injury_reminders');

  CREATE POLICY injury_reminders_select
    ON public.injury_reminders FOR SELECT TO authenticated
    USING (
      public.is_app_admin()
      OR coalesce(is_public, true) = true
      OR created_by = auth.uid()
    );

  CREATE POLICY injury_reminders_insert
    ON public.injury_reminders FOR INSERT TO authenticated
    WITH CHECK (
      public.is_app_admin()
      OR created_by = auth.uid()
      OR created_by IS NULL
    );

  CREATE POLICY injury_reminders_update
    ON public.injury_reminders FOR UPDATE TO authenticated
    USING (
      public.is_app_admin()
      OR coalesce(is_public, true) = true
      OR created_by = auth.uid()
    )
    WITH CHECK (
      public.is_app_admin()
      OR coalesce(is_public, true) = true
      OR created_by = auth.uid()
    );

  CREATE POLICY injury_reminders_delete
    ON public.injury_reminders FOR DELETE TO authenticated
    USING (
      public.is_app_admin()
      OR coalesce(is_public, true) = true
      OR created_by = auth.uid()
    );

  RAISE NOTICE '005: injury_reminders policies OK';
END $$;

-- -----------------------------------------------------------------------------
-- FASE 1e — activity_modification_notifications: solo utenti autenticati
-- (non è own-row: broadcast operatori; chiude anon)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.activity_modification_notifications') IS NULL THEN
    RAISE NOTICE '005: skip activity_modification_notifications (tabella assente)';
    RETURN;
  END IF;

  ALTER TABLE public.activity_modification_notifications ENABLE ROW LEVEL SECURITY;
  PERFORM public._drop_all_policies('public', 'activity_modification_notifications');

  CREATE POLICY activity_mod_notif_select
    ON public.activity_modification_notifications FOR SELECT TO authenticated
    USING (true);

  CREATE POLICY activity_mod_notif_insert
    ON public.activity_modification_notifications FOR INSERT TO authenticated
    WITH CHECK (true);

  CREATE POLICY activity_mod_notif_delete
    ON public.activity_modification_notifications FOR DELETE TO authenticated
    USING (true);

  RAISE NOTICE '005: activity_modification_notifications policies OK';
END $$;

-- -----------------------------------------------------------------------------
-- Cleanup helper interno (opzionale: resta per future migrazioni)
-- -----------------------------------------------------------------------------
-- Lasciamo _drop_all_policies per 006+; revoke da anon/authenticated
REVOKE ALL ON FUNCTION public._drop_all_policies(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._drop_all_policies(text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public._drop_all_policies(text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
