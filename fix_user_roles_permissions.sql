-- ========================================
-- SCRIPT COMPLETO PER RISOLVERE USER_ROLES E PERMESSI
-- ========================================

-- 1. CREA LA TABELLA user_roles SE NON ESISTE
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position_order integer NOT NULL DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id)
);

-- 2. ABILITA RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. CREA POLITICA PER LETTURA
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND policyname = 'Ruoli utenti visibili a tutti gli autenticati'
  ) THEN
    CREATE POLICY "Ruoli utenti visibili a tutti gli autenticati" ON public.user_roles
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 4. CREA LA TABELLA permissions SE NON ESISTE
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL,
  position_order integer NOT NULL DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);

-- 5. ABILITA RLS PER permissions
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- 6. CREA POLITICA PER permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'permissions' 
    AND policyname = 'Permessi visibili a tutti gli autenticati'
  ) THEN
    CREATE POLICY "Permessi visibili a tutti gli autenticati" ON public.permissions
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 7. CREA LA TABELLA role_permissions SE NON ESISTE
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE
);

-- 8. ABILITA RLS PER role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 9. CREA POLITICA PER role_permissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'role_permissions' 
    AND policyname = 'Collegamenti ruolo-permesso visibili a tutti gli autenticati'
  ) THEN
    CREATE POLICY "Collegamenti ruolo-permesso visibili a tutti gli autenticati" ON public.role_permissions
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- 10. PULISCI E INSERISCI I RUOLI
DELETE FROM public.user_roles;

INSERT INTO public.user_roles (name, position_order) VALUES
  ('Admin', 1),
  ('Dirigente', 2),
  ('Segreteria', 3),
  ('Direttore Sportivo', 4),
  ('Direttore Tecnico', 5),
  ('Allenatore', 6),
  ('Team Manager', 7),
  ('Accompagnatore', 8),
  ('Preparatore', 9),
  ('Medico', 10),
  ('Fisio', 11),
  ('Player', 12),
  ('Famiglia', 13);

-- 11. PULISCI E INSERISCI I PERMESSI
DELETE FROM public.permissions;

INSERT INTO public.permissions (name, description, category, position_order) VALUES 
-- Giocatori
('players.view', 'Visualizza giocatori', 'players', 1),
('players.create', 'Crea giocatori', 'players', 2),
('players.edit', 'Modifica giocatori', 'players', 3),
('players.delete', 'Elimina giocatori', 'players', 4),
('players.export', 'Esporta giocatori', 'players', 5),

-- Eventi
('events.view', 'Visualizza eventi', 'events', 1),
('events.create', 'Crea eventi', 'events', 2),
('events.edit', 'Modifica eventi', 'events', 3),
('events.delete', 'Elimina eventi', 'events', 4),

-- Sessioni
('sessions.view', 'Visualizza sessioni', 'sessions', 1),
('sessions.create', 'Crea sessioni', 'sessions', 2),
('sessions.edit', 'Modifica sessioni', 'sessions', 3),
('sessions.delete', 'Elimina sessioni', 'sessions', 4),
('sessions.start', 'Avvia sessioni', 'sessions', 5),
('sessions.stop', 'Ferma sessioni', 'sessions', 6),

-- Presenze
('attendance.view', 'Visualizza presenze', 'attendance', 1),
('attendance.mark', 'Segna presenze', 'attendance', 2),
('attendance.edit', 'Modifica presenze', 'attendance', 3),
('attendance.export', 'Esporta presenze', 'attendance', 4),

-- Staff
('staff.view', 'Visualizza staff', 'staff', 1),
('staff.create', 'Crea staff', 'staff', 2),
('staff.edit', 'Modifica staff', 'staff', 3),
('staff.delete', 'Elimina staff', 'staff', 4),

-- Categorie
('categories.view', 'Visualizza categorie', 'categories', 1),
('categories.create', 'Crea categorie', 'categories', 2),
('categories.edit', 'Modifica categorie', 'categories', 3),
('categories.delete', 'Elimina categorie', 'categories', 4),

-- Impostazioni
('settings.view', 'Visualizza impostazioni', 'settings', 1),
('settings.edit', 'Modifica impostazioni', 'settings', 2),
('settings.brand', 'Gestisce brand', 'settings', 3),

-- Utenti
('users.view', 'Visualizza utenti', 'users', 1),
('users.create', 'Crea utenti', 'users', 2),
('users.edit', 'Modifica utenti', 'users', 3),
('users.delete', 'Elimina utenti', 'users', 4),
('users.roles', 'Gestisce ruoli utenti', 'users', 5),

-- Consiglio
('council.manage', 'Gestisce consiglio', 'council', 1),

-- Brand
('brand.manage', 'Gestisce brand', 'brand', 1);

-- 12. PULISCI E INSERISCI I COLLEGAMENTI RUOLO-PERMESSI
DELETE FROM public.role_permissions;

-- Admin: accesso completo a tutto
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Admin';

-- Dirigente: quasi tutto tranne gestione utenti
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Dirigente'
AND p.name IN (
  'players.view', 'players.create', 'players.edit', 'players.delete', 'players.export',
  'events.view', 'events.create', 'events.edit', 'events.delete',
  'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.delete', 'sessions.start', 'sessions.stop',
  'attendance.view', 'attendance.mark', 'attendance.edit', 'attendance.export',
  'staff.view',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'settings.view', 'settings.edit', 'settings.brand',
  'users.view',
  'council.manage',
  'brand.manage'
);

-- Segreteria: gestione amministrativa
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Segreteria'
AND p.name IN (
  'players.view', 'players.create', 'players.edit',
  'events.view',
  'sessions.view',
  'attendance.view',
  'staff.view',
  'categories.view',
  'users.view'
);

-- Allenatore: gestione allenamenti
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Allenatore'
AND p.name IN (
  'players.view', 'players.edit',
  'events.view', 'events.create', 'events.edit',
  'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.start', 'sessions.stop',
  'attendance.view', 'attendance.mark', 'attendance.edit',
  'categories.view'
);

-- Player: solo i propri dati
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT ur.id, p.id
FROM public.user_roles ur, public.permissions p
WHERE ur.name = 'Player'
AND p.name IN (
  'players.view',
  'events.view',
  'sessions.view',
  'attendance.view',
  'categories.view'
);

-- 13. VERIFICA IL RISULTATO
SELECT 
  'VERIFICA FINALE' as status,
  (SELECT COUNT(*) FROM public.user_roles) as total_roles,
  (SELECT COUNT(*) FROM public.permissions) as total_permissions,
  (SELECT COUNT(*) FROM public.role_permissions) as total_role_permissions;

-- 14. MOSTRA I RUOLI INSERITI
SELECT 
  name, 
  position_order
FROM public.user_roles 
ORDER BY position_order;

-- 15. MOSTRA I PERMESSI PER RUOLO
SELECT 
  ur.name as ruolo,
  COUNT(rp.permission_id) as permessi_totali
FROM public.user_roles ur
LEFT JOIN public.role_permissions rp ON ur.id = rp.role_id
GROUP BY ur.id, ur.name, ur.position_order
ORDER BY ur.position_order;








