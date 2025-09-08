-- Script per creare le tabelle per la gestione infortuni
-- Esegui questo script nel tuo database Supabase

-- ========================================
-- CREAZIONE TABELLA INJURIES
-- ========================================

-- Crea la tabella injuries
CREATE TABLE IF NOT EXISTS public.injuries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  injury_date date NOT NULL DEFAULT CURRENT_DATE,
  injury_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('Lieve', 'Moderato', 'Grave')),
  body_part text NOT NULL,
  body_part_description text,
  cause text NOT NULL,
  treating_doctor text,
  current_status text NOT NULL DEFAULT 'In corso' CHECK (current_status IN ('In corso', 'Guarito', 'Ricaduta', 'Cronico')),
  expected_weeks_off integer,
  created_by text NOT NULL DEFAULT 'Sistema',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT injuries_pkey PRIMARY KEY (id),
  CONSTRAINT injuries_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE
);

-- ========================================
-- CREAZIONE TABELLA INJURY_ACTIVITIES
-- ========================================

-- Crea la tabella injury_activities
CREATE TABLE IF NOT EXISTS public.injury_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  injury_id uuid NOT NULL,
  activity_date timestamp with time zone NOT NULL DEFAULT now(),
  activity_type text NOT NULL,
  activity_description text NOT NULL,
  duration_minutes integer,
  operator_name text,
  notes text,
  created_by text NOT NULL DEFAULT 'Sistema',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT injury_activities_pkey PRIMARY KEY (id),
  CONSTRAINT injury_activities_injury_id_fkey FOREIGN KEY (injury_id) REFERENCES public.injuries(id) ON DELETE CASCADE
);

-- ========================================
-- CREAZIONE INDICI
-- ========================================

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_injuries_person_id ON public.injuries(person_id);
CREATE INDEX IF NOT EXISTS idx_injuries_injury_date ON public.injuries(injury_date);
CREATE INDEX IF NOT EXISTS idx_injuries_current_status ON public.injuries(current_status);
CREATE INDEX IF NOT EXISTS idx_injury_activities_injury_id ON public.injury_activities(injury_id);
CREATE INDEX IF NOT EXISTS idx_injury_activities_activity_date ON public.injury_activities(activity_date);

-- ========================================
-- ABILITAZIONE RLS
-- ========================================

-- Abilita RLS (Row Level Security)
ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_activities ENABLE ROW LEVEL SECURITY;

-- Crea politiche per gli infortuni
CREATE POLICY "Infortuni gestibili da staff autorizzato" ON public.injuries
  FOR ALL USING (auth.role() = 'authenticated');

-- Crea politiche per le attività infortuni
CREATE POLICY "Attività infortuni gestibili da staff autorizzato" ON public.injury_activities
  FOR ALL USING (auth.role() = 'authenticated');

-- ========================================
-- COMMENTI PER DOCUMENTAZIONE
-- ========================================

COMMENT ON TABLE public.injuries IS 'Registro infortuni dei giocatori';
COMMENT ON COLUMN public.injuries.person_id IS 'ID della persona (giocatore)';
COMMENT ON COLUMN public.injuries.injury_date IS 'Data dell''infortunio';
COMMENT ON COLUMN public.injuries.injury_type IS 'Tipologia dell''infortunio';
COMMENT ON COLUMN public.injuries.severity IS 'Gravità: Lieve, Moderato, Grave';
COMMENT ON COLUMN public.injuries.body_part IS 'Parte del corpo interessata';
COMMENT ON COLUMN public.injuries.body_part_description IS 'Descrizione dettagliata della parte del corpo';
COMMENT ON COLUMN public.injuries.cause IS 'Causa dell''infortunio';
COMMENT ON COLUMN public.injuries.treating_doctor IS 'Nome del medico curante';
COMMENT ON COLUMN public.injuries.current_status IS 'Stato attuale dell''infortunio';
COMMENT ON COLUMN public.injuries.expected_weeks_off IS 'Previsione settimane di stop';

COMMENT ON TABLE public.injury_activities IS 'Attività e trattamenti per ogni infortunio';
COMMENT ON COLUMN public.injury_activities.injury_id IS 'ID dell''infortunio di riferimento';
COMMENT ON COLUMN public.injury_activities.activity_type IS 'Tipo di attività (Visita medica, Fisioterapia, Test, etc.)';
COMMENT ON COLUMN public.injury_activities.activity_description IS 'Descrizione dell''attività';
COMMENT ON COLUMN public.injury_activities.duration_minutes IS 'Durata in minuti (per fisioterapia)';
COMMENT ON COLUMN public.injury_activities.operator_name IS 'Nome dell''operatore/medico';
COMMENT ON COLUMN public.injury_activities.notes IS 'Note aggiuntive sull''attività';
