-- Script COMPLETO per risolvere il problema del tab Staff
-- Esegui questo script nel SQL Editor di Supabase

-- 1. Crea la tabella user_roles se non esiste
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position_order integer NOT NULL DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id)
);

-- 2. Abilita RLS se non è già abilitato
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Crea politica per lettura (se non esiste)
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

-- 4. Pulisci e inserisci i ruoli staff
DELETE FROM public.user_roles;

INSERT INTO public.user_roles (id, name, position_order) VALUES
  (gen_random_uuid(), 'Admin', 1),
  (gen_random_uuid(), 'Dirigente', 2),
  (gen_random_uuid(), 'Segreteria', 3),
  (gen_random_uuid(), 'Direttore Sportivo', 4),
  (gen_random_uuid(), 'Direttore Tecnico', 5),
  (gen_random_uuid(), 'Allenatore', 6),
  (gen_random_uuid(), 'Team Manager', 7),
  (gen_random_uuid(), 'Accompagnatore', 8),
  (gen_random_uuid(), 'Preparatore', 9),
  (gen_random_uuid(), 'Medico', 10),
  (gen_random_uuid(), 'Fisio', 11),
  (gen_random_uuid(), 'Player', 12),
  (gen_random_uuid(), 'Famiglia', 13);

-- 5. Verifica il risultato
SELECT 
  'VERIFICA FINALE' as status,
  COUNT(*) as total_roles,
  string_agg(name, ', ' ORDER BY position_order) as ruoli_inseriti
FROM public.user_roles;

-- 6. Mostra i primi 5 ruoli per conferma
SELECT 
  name, 
  position_order
FROM public.user_roles 
ORDER BY position_order 
LIMIT 5;


