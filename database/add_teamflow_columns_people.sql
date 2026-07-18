-- Aggiunge le colonne TeamFlow (webapp) alla tabella people.
-- Stesso set di opzioni di Flowme: ruolo, ruoli aggiuntivi, sezioni visibili, blocco accesso, categorie (admin).
-- Esegui in Supabase → SQL Editor.

-- teamflow_app_role: ruolo nella webapp TeamFlow (stesso tipo di app_role)
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS teamflow_app_role TEXT;

-- teamflow_additional_roles: ruoli aggiuntivi (jsonb array, come additional_roles)
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS teamflow_additional_roles JSONB DEFAULT '[]'::jsonb;

-- teamflow_sections: sezioni visibili nella webapp (jsonb array, come flowme_sections)
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS teamflow_sections JSONB DEFAULT '[]'::jsonb;

-- teamflow_access_blocked: blocca accesso alla webapp
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS teamflow_access_blocked BOOLEAN DEFAULT FALSE;

-- teamflow_staff_categories: categorie (squadre) visibili per admin nella webapp (jsonb array, come staff_categories)
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS teamflow_staff_categories JSONB;

COMMENT ON COLUMN public.people.teamflow_app_role IS 'Ruolo nella webapp TeamFlow';
COMMENT ON COLUMN public.people.teamflow_additional_roles IS 'Ruoli aggiuntivi nella webapp TeamFlow';
COMMENT ON COLUMN public.people.teamflow_sections IS 'Sezioni visibili nella webapp TeamFlow';
COMMENT ON COLUMN public.people.teamflow_access_blocked IS 'Se true, la persona non può accedere alla webapp TeamFlow';
COMMENT ON COLUMN public.people.teamflow_staff_categories IS 'Categorie (squadre) visibili nella webapp TeamFlow (per admin)';
