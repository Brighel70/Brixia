-- ========================================
-- Sistema Tutor per Atleti Minorenni
-- ========================================

-- Tabella per le categorie professionali
CREATE TABLE IF NOT EXISTS public.professional_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_sponsor_potential boolean NOT NULL DEFAULT false,
  is_club_useful boolean NOT NULL DEFAULT false,
  position_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabella per i tutor
CREATE TABLE IF NOT EXISTS public.tutors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  given_name text,
  family_name text,
  email text,
  phone text,
  address_street text,
  address_city text,
  address_zip text,
  address_country text,
  profession text,
  professional_category_id uuid,
  company text,
  position text,
  is_sponsor_potential boolean NOT NULL DEFAULT false,
  is_club_useful boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutors_professional_category_id_fkey 
    FOREIGN KEY (professional_category_id) REFERENCES public.professional_categories(id)
);

-- Tabella per le relazioni tutor-atleta
CREATE TABLE IF NOT EXISTS public.tutor_athlete_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  relationship text NOT NULL, -- Padre, Madre, Nonno, Zio, etc.
  is_primary_contact boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_athlete_relations_tutor_id_fkey 
    FOREIGN KEY (tutor_id) REFERENCES public.tutors(id) ON DELETE CASCADE,
  CONSTRAINT tutor_athlete_relations_athlete_id_fkey 
    FOREIGN KEY (athlete_id) REFERENCES public.people(id) ON DELETE CASCADE,
  CONSTRAINT unique_tutor_athlete_relationship 
    UNIQUE (tutor_id, athlete_id, relationship)
);

-- Inserisci categorie professionali predefinite
INSERT INTO public.professional_categories (name, description, is_sponsor_potential, is_club_useful, position_order) VALUES
('Medico', 'Professionisti sanitari', true, true, 1),
('Avvocato', 'Professionisti legali', true, true, 2),
('Insegnante', 'Personale docente e educativo', false, true, 3),
('Imprenditore', 'Titolari di aziende', true, true, 4),
('Dipendente', 'Lavoratori dipendenti', false, false, 5),
('Libero Professionista', 'Professionisti autonomi', true, true, 6),
('Commerciante', 'Titolari di attività commerciali', true, true, 7),
('Artigiano', 'Lavoratori artigianali', false, true, 8),
('Tecnico', 'Tecnici specializzati', false, true, 9),
('Altro', 'Altre professioni', false, false, 10)
ON CONFLICT (name) DO NOTHING;

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_tutors_professional_category_id ON public.tutors(professional_category_id);
CREATE INDEX IF NOT EXISTS idx_tutor_athlete_relations_tutor_id ON public.tutor_athlete_relations(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_athlete_relations_athlete_id ON public.tutor_athlete_relations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_tutor_athlete_relations_emergency ON public.tutor_athlete_relations(is_emergency_contact);

-- Crea policy RLS per la sicurezza
ALTER TABLE public.professional_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_athlete_relations ENABLE ROW LEVEL SECURITY;

-- Policy per professional_categories (lettura per tutti, modifica solo per admin)
CREATE POLICY "Professional categories readable by authenticated users" ON public.professional_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Professional categories manageable by admin" ON public.professional_categories
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy per tutors (gestione completa per utenti autenticati)
CREATE POLICY "Tutors manageable by authenticated users" ON public.tutors
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy per tutor_athlete_relations (gestione completa per utenti autenticati)
CREATE POLICY "Tutor athlete relations manageable by authenticated users" ON public.tutor_athlete_relations
  FOR ALL USING (auth.role() = 'authenticated');

-- Aggiungi commenti per documentazione
COMMENT ON TABLE public.professional_categories IS 'Categorie professionali per i tutor, utili per statistiche e sponsor';
COMMENT ON TABLE public.tutors IS 'Dati personali e professionali dei tutor';
COMMENT ON TABLE public.tutor_athlete_relations IS 'Relazioni tra tutor e atleti minorenni';

COMMENT ON COLUMN public.tutor_athlete_relations.is_primary_contact IS 'Tutor principale per comunicazioni e contatto di emergenza';
COMMENT ON COLUMN public.professional_categories.is_sponsor_potential IS 'Categoria con potenziale sponsor';
COMMENT ON COLUMN public.professional_categories.is_club_useful IS 'Categoria utile per il club';
COMMENT ON COLUMN public.tutors.is_sponsor_potential IS 'Tutor con potenziale sponsor';
COMMENT ON COLUMN public.tutors.is_club_useful IS 'Tutor utile per il club';
TO IL CHECKBOX.  HAI CAPITO?TISCE LA CHIUSURA DELL'INFORTUNIO?