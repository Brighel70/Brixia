// Script per configurare automaticamente il database Supabase
// Esegui questo script nel dashboard Supabase SQL Editor

console.log('🚀 Configurazione automatica database Supabase per BRIXIA Rugby')
console.log('📋 Copia e incolla questi script uno alla volta nel SQL Editor di Supabase')

// 1. SETUP INIZIALE DATABASE
const setupDatabase = `
-- ========================================
-- SETUP INIZIALE DATABASE BRIXIA RUGBY
-- ========================================

-- Abilita estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crea enum per i ruoli
CREATE TYPE role_enum AS ENUM ('admin', 'coach', 'medic', 'director');

-- Crea enum per le location
CREATE TYPE location_enum AS ENUM ('Brescia', 'Gussago', 'Ospitaletto', 'Trasferta');

-- Crea enum per gli stati presenze
CREATE TYPE status_enum AS ENUM ('PRESENTE', 'ASSENTE', 'INFORTUNATO', 'PERMESSO', 'MALATO');

-- Crea enum per luoghi infortunio
CREATE TYPE injured_place_enum AS ENUM ('CASA', 'PALESTRA');

-- ========================================
-- TABELLE PRINCIPALI
-- ========================================

-- Tabella categorie
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  sort integer NOT NULL DEFAULT 999,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

-- Tabella ruoli giocatori
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position_order integer NOT NULL DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

-- Tabella giocatori
CREATE TABLE IF NOT EXISTS public.players (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  birth_year integer,
  role_on_field text,
  injured boolean NOT NULL DEFAULT false,
  aggregated_seniores boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  role_id uuid,
  fir_code text,
  CONSTRAINT players_pkey PRIMARY KEY (id),
  CONSTRAINT players_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);

-- Tabella profili utenti
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text,
  role role_enum NOT NULL DEFAULT 'coach',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  password text,
  email text,
  user_role_id uuid,
  phone text,
  first_name text,
  last_name text,
  birth_year integer,
  fir_code text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- Tabella ruoli utenti
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position_order integer NOT NULL DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id)
);

-- Tabella permessi
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL,
  position_order integer NOT NULL DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);

-- Tabella sessioni
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_date date NOT NULL,
  category_id uuid,
  location location_enum NOT NULL,
  away_place text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sessions_pkey PRIMARY KEY (id),
  CONSTRAINT sessions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- Tabella presenze
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  player_id uuid,
  status status_enum NOT NULL,
  injured_place injured_place_enum,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id),
  CONSTRAINT attendance_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id)
);

-- Tabella collegamenti giocatori-categorie
CREATE TABLE IF NOT EXISTS public.player_categories (
  player_id uuid NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT player_categories_pkey PRIMARY KEY (player_id, category_id),
  CONSTRAINT player_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT player_categories_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id)
);

-- Tabella collegamenti staff-categorie
CREATE TABLE IF NOT EXISTS public.staff_categories (
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  CONSTRAINT staff_categories_pkey PRIMARY KEY (user_id, category_id),
  CONSTRAINT staff_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);

-- Tabella collegamenti ruoli-permessi
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (public.permissions(id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id)
);

-- ========================================
-- INDICI PER PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_players_last_name ON public.players(last_name);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON public.attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON public.categories(sort);

-- ========================================
-- POLITICHE RLS (Row Level Security)
-- ========================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_categories ENABLE ROW LEVEL SECURITY;

-- Politiche per categorie (lettura pubblica)
CREATE POLICY "Categorie visibili a tutti" ON public.categories
  FOR SELECT USING (true);

-- Politiche per giocatori (lettura per staff autenticato)
CREATE POLICY "Giocatori visibili a staff autenticato" ON public.players
  FOR SELECT USING (auth.role() = 'authenticated');

-- Politiche per presenze (lettura/scrittura per staff autenticato)
CREATE POLICY "Presenze gestibili da staff autenticato" ON public.attendance
  FOR ALL USING (auth.role() = 'authenticated');

-- Politiche per sessioni (lettura/scrittura per staff autenticato)
CREATE POLICY "Sessioni gestibili da staff autenticato" ON public.sessions
  FOR ALL USING (auth.role() = 'authenticated');

console.log('✅ Script setup database creato!')
console.log('📋 Copia e incolla nel SQL Editor di Supabase')
`

// 2. POPOLAMENTO DATI INIZIALI
const populateData = `
-- ========================================
-- POPOLAMENTO DATI INIZIALI
-- ========================================

-- Inserisci categorie standard
INSERT INTO public.categories (code, name, sort) VALUES 
('U8', 'Under 8', 1),
('U10', 'Under 10', 2),
('U12', 'Under 12', 3),
('U14', 'Under 14', 4),
('U16', 'Under 16', 5),
('U18', 'Under 18', 6),
('SENIORES', 'Seniores', 7)
ON CONFLICT (code) DO NOTHING;

-- Inserisci ruoli giocatori
INSERT INTO public.roles (name, position_order) VALUES 
('Pilone', 1),
('Tallonatore', 2),
('Seconda Linea', 3),
('Terza Linea', 4),
('Mediano di Mischia', 5),
('Mediano d''Apertura', 6),
('Centro', 7),
('Ala', 8),
('Estremo', 9)
ON CONFLICT (name) DO NOTHING;

-- Inserisci ruoli utenti
INSERT INTO public.user_roles (name, position_order) VALUES 
('Admin', 1),
('Coach', 2),
('Medic', 3),
('Director', 4),
('Staff', 5),
('Team Manager', 6),
('Accompagnatore', 7)
ON CONFLICT (name) DO NOTHING;

-- Inserisci permessi base
INSERT INTO public.permissions (name, description, category, position_order) VALUES 
('view_activities', 'Visualizza attività', 'activities', 1),
('create_activities', 'Crea attività', 'activities', 2),
('manage_attendance', 'Gestisce presenze', 'activities', 3),
('view_players', 'Visualizza giocatori', 'players', 1),
('create_players', 'Crea giocatori', 'players', 2),
('view_users', 'Visualizza utenti', 'users', 1),
('create_users', 'Crea utenti', 'users', 2),
('manage_settings', 'Gestisce impostazioni', 'system', 1)
ON CONFLICT (name) DO NOTHING;

-- Crea utente admin di default (password: admin123)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@brixia.local',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Inserisci profilo admin
INSERT INTO public.profiles (id, full_name, role, email, first_name, last_name)
SELECT 
  u.id,
  'Amministratore Brixia',
  'admin',
  u.email,
  'Amministratore',
  'Brixia'
FROM auth.users u 
WHERE u.email = 'admin@brixia.local'
ON CONFLICT (id) DO NOTHING;

console.log('✅ Script popolamento dati creato!')
console.log('📋 Copia e incolla nel SQL Editor di Supabase DOPO il primo script')
`

// 3. VERIFICA CONFIGURAZIONE
const verifySetup = `
-- ========================================
-- VERIFICA CONFIGURAZIONE
-- ========================================

-- Conta le tabelle create
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Conta le categorie
SELECT COUNT(*) as total_categories FROM public.categories;

-- Conta i ruoli
SELECT COUNT(*) as total_roles FROM public.roles;

-- Conta i permessi
SELECT COUNT(*) as total_permissions FROM public.permissions;

-- Verifica utente admin
SELECT 
  p.full_name,
  p.role,
  p.email
FROM public.profiles p
WHERE p.role = 'admin';

console.log('✅ Script verifica creato!')
console.log('📋 Copia e incolla nel SQL Editor di Supabase per verificare la configurazione')
`

// Esporta gli script
export { setupDatabase, populateData, verifySetup }

