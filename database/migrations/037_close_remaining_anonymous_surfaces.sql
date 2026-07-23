-- =============================================================================
-- 037_close_remaining_anonymous_surfaces.sql
-- Elimina i grant anonimi residui e sostituisce le ultime policy con ruolo
-- public. Il brand resta l'unica lettura pubblica intenzionale.
-- =============================================================================

BEGIN;

-- Queste tabelle hanno gia' RLS e policy proprie. Rimuoviamo il grant ereditato
-- da PUBLIC/anon e manteniamo l'operativita' esclusivamente autenticata.
REVOKE ALL ON TABLE
  public.correspondence_home_hidden,
  public.correspondence_home_opened,
  public.correspondence_messages,
  public.correspondence_participants,
  public.correspondence_reads,
  public.correspondence_threads,
  public.notifications,
  public.permissions,
  public.push_subscriptions,
  public.push_tokens
FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.correspondence_home_hidden,
  public.correspondence_home_opened,
  public.correspondence_messages,
  public.correspondence_participants,
  public.correspondence_reads,
  public.correspondence_threads,
  public.notifications,
  public.permissions,
  public.push_subscriptions,
  public.push_tokens
TO authenticated, service_role;

-- Membri del consiglio: policy esplicitamente autenticata e permesso unico.
ALTER TABLE public.council_members ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'council_members');
CREATE POLICY council_members_manage_authorized ON public.council_members
  FOR ALL TO authenticated
  USING (public.has_app_permission('council.manage'))
  WITH CHECK (public.has_app_permission('council.manage'));
REVOKE ALL ON TABLE public.council_members FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.council_members TO authenticated, service_role;

-- Memo personali: invariata la regola "solo il proprietario", ma senza ruolo
-- public e senza grant per connessioni anonime.
ALTER TABLE public.user_memos ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'user_memos');
CREATE POLICY user_memos_select_own ON public.user_memos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY user_memos_insert_own ON public.user_memos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_memos_update_own ON public.user_memos FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_memos_delete_own ON public.user_memos FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON TABLE public.user_memos FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_memos TO authenticated, service_role;

-- Catalogo ruoli e permessi: ogni utente autenticato puo' leggere il catalogo;
-- soltanto chi possiede users.manage_permissions puo' modificarlo via RPC/UI.
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
SELECT public._drop_all_policies('public', 'user_permissions');
SELECT public._drop_all_policies('public', 'user_roles');

CREATE POLICY user_permissions_select_authorized ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_app_permission('users.manage_permissions')
  );
CREATE POLICY user_permissions_manage_authorized ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_app_permission('users.manage_permissions'));
CREATE POLICY user_permissions_update_authorized ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (public.has_app_permission('users.manage_permissions'))
  WITH CHECK (public.has_app_permission('users.manage_permissions'));
CREATE POLICY user_permissions_delete_authorized ON public.user_permissions
  FOR DELETE TO authenticated
  USING (public.has_app_permission('users.manage_permissions'));

CREATE POLICY user_roles_select_authenticated ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY user_roles_manage_authorized ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_app_permission('users.manage_permissions'))
  WITH CHECK (public.has_app_permission('users.manage_permissions'));

REVOKE ALL ON TABLE public.user_permissions, public.user_roles FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_permissions, public.user_roles
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
