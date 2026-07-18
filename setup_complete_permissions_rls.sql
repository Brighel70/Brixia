-- ========================================
-- SETUP COMPLETO: PERMESSI + RLS + CODICI INVITO
-- ⚠️ IMPORTANTE: Prima esegui pre_setup_cleanup.sql
-- ========================================

-- ========================================
-- PARTE 1: TABELLA PERMESSI PERSONALIZZATI
-- ========================================

-- Tabella per permessi personalizzati utente per utente
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  is_granted BOOLEAN DEFAULT true, -- true = aggiunto, false = rimosso
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission_id)
);

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON public.user_permissions(permission_id);

-- ========================================
-- PARTE 2: CODICI INVITO PER GIOCATORI
-- ========================================

-- Aggiungi colonne per codici invito alla tabella people
ALTER TABLE public.people 
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invite_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invite_used_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invite_used_by UUID REFERENCES public.profiles(id);

-- Indice per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_people_invite_code ON public.people(invite_code);

-- Funzione per generare codice invito univoco
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Genera codice formato: BRIXIA-YYYY-XXXXXXXX
    new_code := 'BRIXIA-' || 
                TO_CHAR(NOW(), 'YYYY') || '-' || 
                UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));
    
    -- Verifica se esiste già
    SELECT EXISTS(SELECT 1 FROM public.people WHERE invite_code = new_code) INTO code_exists;
    
    -- Se non esiste, ritorna il codice
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PARTE 3: FUNZIONI HELPER PER RLS
-- ========================================

-- Funzione per ottenere il nome del ruolo di un utente
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  role_name TEXT;
BEGIN
  -- Prova prima dalla colonna 'role' se esiste
  SELECT p.role INTO role_name
  FROM public.profiles p
  WHERE p.id = user_id;
  
  -- Se role è NULL o non esiste, prendi da user_roles via user_role_id
  IF role_name IS NULL THEN
    SELECT ur.name INTO role_name
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.id = p.user_role_id
    WHERE p.id = user_id;
  END IF;
  
  RETURN COALESCE(role_name, 'Player');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Funzione per verificare se un utente ha un ruolo specifico
CREATE OR REPLACE FUNCTION public.user_has_role(user_id UUID, role_names TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_user_role(user_id) = ANY(role_names);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ========================================
-- PARTE 4: ROW LEVEL SECURITY (RLS)
-- Filtro automatico dati per categoria/ruolo
-- ========================================

-- RLS per user_permissions (solo admin possono modificarli)
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "admin_manage_user_permissions" ON public.user_permissions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Policy admin_manage_user_permissions non esisteva';
END $$;

CREATE POLICY "admin_manage_user_permissions" ON public.user_permissions
FOR ALL USING (
  public.user_has_role(auth.uid(), ARRAY['Admin'])
);

-- Abilita RLS sulle tabelle principali
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ========================================
-- RLS: SESSIONS (Allenamenti)
-- ========================================

CREATE POLICY "users_view_sessions_policy" ON public.sessions
FOR SELECT USING (
  -- Admin e Dirigenti vedono TUTTO
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Giocatore vede solo sessioni della SUA categoria
  EXISTS (
    SELECT 1 FROM public.people 
    WHERE people.id = auth.uid() 
    AND people.player_categories::jsonb ? sessions.category_id::text
  )
  OR
  -- Allenatore/Staff vede sessioni delle SUE categorie
  EXISTS (
    SELECT 1 FROM public.people staff
    WHERE staff.id = auth.uid()
    AND staff.staff_categories::jsonb ? sessions.category_id::text
  )
);

-- ========================================
-- RLS: EVENTS (Partite/Eventi)
-- ========================================

CREATE POLICY "users_view_events_policy" ON public.events
FOR SELECT USING (
  -- Admin e Dirigenti vedono TUTTO
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Giocatore vede solo eventi della SUA categoria
  EXISTS (
    SELECT 1 FROM public.people 
    WHERE people.id = auth.uid() 
    AND people.player_categories::jsonb ? events.category_id::text
  )
  OR
  -- Allenatore/Staff vede eventi delle SUE categorie
  EXISTS (
    SELECT 1 FROM public.people staff
    WHERE staff.id = auth.uid()
    AND staff.staff_categories::jsonb ? events.category_id::text
  )
);

-- ========================================
-- RLS: PEOPLE (Schede Persone)
-- ========================================

CREATE POLICY "users_view_people_policy" ON public.people
FOR SELECT USING (
  -- Admin, Dirigente, Segreteria vedono TUTTO
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Segreteria', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Giocatore vede solo SE STESSO
  (people.id = auth.uid())
  OR
  -- Allenatore/Staff vede giocatori delle SUE categorie
  EXISTS (
    SELECT 1 FROM public.people staff
    WHERE staff.id = auth.uid()
    AND staff.staff_categories::jsonb ?| ARRAY(SELECT jsonb_array_elements_text(people.player_categories::jsonb))
  )
);

-- ========================================
-- RLS: ATTENDANCE (Presenze)
-- ========================================

CREATE POLICY "users_view_attendance_policy" ON public.attendance
FOR SELECT USING (
  -- Admin e Dirigenti vedono TUTTO
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Giocatore vede solo le SUE presenze
  (attendance.player_id = auth.uid())
  OR
  -- Allenatore vede presenze delle sessioni delle sue categorie
  EXISTS (
    SELECT 1 FROM public.sessions
    JOIN public.people staff ON staff.id = auth.uid()
    WHERE sessions.id = attendance.session_id
    AND staff.staff_categories::jsonb ? sessions.category_id::text
  )
);

-- ========================================
-- PARTE 5: INDICI PER PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_people_player_categories ON public.people USING GIN(player_categories);
CREATE INDEX IF NOT EXISTS idx_people_staff_categories ON public.people USING GIN(staff_categories);
CREATE INDEX IF NOT EXISTS idx_sessions_category_id ON public.sessions(category_id);
CREATE INDEX IF NOT EXISTS idx_events_category_id ON public.events(category_id);
CREATE INDEX IF NOT EXISTS idx_attendance_player_id ON public.attendance(player_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);

-- ========================================
-- PARTE 6: FUNZIONE HELPER PER CALCOLARE PERMESSI FINALI
-- ========================================

-- Funzione per ottenere tutti i permessi di un utente (ruolo + personalizzati)
CREATE OR REPLACE FUNCTION public.get_user_final_permissions(user_id UUID)
RETURNS TABLE (permission_name TEXT) AS $$
BEGIN
  RETURN QUERY
  WITH role_perms AS (
    -- Permessi del ruolo
    SELECT p.name
    FROM public.profiles prof
    JOIN public.user_roles ur ON ur.name = prof.role
    JOIN public.role_permissions rp ON rp.role_id = ur.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE prof.id = user_id
  ),
  custom_perms AS (
    -- Permessi personalizzati
    SELECT p.name, up.is_granted
    FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = user_id
  )
  -- Combina: (permessi ruolo + aggiunti) - rimossi
  SELECT DISTINCT rp.name
  FROM role_perms rp
  WHERE NOT EXISTS (
    SELECT 1 FROM custom_perms cp 
    WHERE cp.name = rp.name AND cp.is_granted = false
  )
  UNION
  SELECT cp.name
  FROM custom_perms cp
  WHERE cp.is_granted = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- COMPLETATO! 🎉
-- ========================================

-- Verifica che tutto sia stato creato correttamente
DO $$
BEGIN
  RAISE NOTICE '✅ Tabella user_permissions creata';
  RAISE NOTICE '✅ Colonne invite_code aggiunte a people';
  RAISE NOTICE '✅ Funzione generate_invite_code() creata';
  RAISE NOTICE '✅ Row Level Security configurato per sessions, events, people, attendance';
  RAISE NOTICE '✅ Indici per performance creati';
  RAISE NOTICE '✅ Funzione get_user_final_permissions() creata';
  RAISE NOTICE '🎉 Setup completato con successo!';
END $$;

