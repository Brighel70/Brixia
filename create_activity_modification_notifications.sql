-- Tabella per notifiche di modifica appuntamento (FlowMe Realtime / app mobile)
-- L'app mobile può iscriversi in Realtime a questa tabella per ricevere avvisi
-- quando un operatore modifica data/orario di un'attività.

CREATE TABLE IF NOT EXISTS public.activity_modification_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL,
  operator_name text NOT NULL,
  player_name text,
  changes_summary text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT activity_modification_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT activity_modification_notifications_activity_id_fkey
    FOREIGN KEY (activity_id) REFERENCES public.injury_activities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_mod_notif_created_at
  ON public.activity_modification_notifications(created_at DESC);

COMMENT ON TABLE public.activity_modification_notifications IS 'Notifiche modifica appuntamento per FlowMe (Realtime)';
