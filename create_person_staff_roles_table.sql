-- Script per creare la tabella person_staff_roles
-- Esegui questo script nel tuo database Supabase

-- 1. Crea la tabella person_staff_roles
CREATE TABLE IF NOT EXISTS public.person_staff_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  staff_role_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT person_staff_roles_pkey PRIMARY KEY (id),
  CONSTRAINT person_staff_roles_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE,
  CONSTRAINT person_staff_roles_staff_role_id_fkey FOREIGN KEY (staff_role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE,
  CONSTRAINT person_staff_roles_unique UNIQUE (person_id, staff_role_id)
);

-- 2. Crea indici per performance
CREATE INDEX IF NOT EXISTS idx_person_staff_roles_person_id ON public.person_staff_roles(person_id);
CREATE INDEX IF NOT EXISTS idx_person_staff_roles_staff_role_id ON public.person_staff_roles(staff_role_id);

-- 3. Abilita RLS sulla tabella
ALTER TABLE public.person_staff_roles ENABLE ROW LEVEL SECURITY;

-- 4. Crea politiche RLS per person_staff_roles
CREATE POLICY IF NOT EXISTS "person_staff_roles_select_policy" ON public.person_staff_roles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "person_staff_roles_insert_policy" ON public.person_staff_roles
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "person_staff_roles_update_policy" ON public.person_staff_roles
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "person_staff_roles_delete_policy" ON public.person_staff_roles
  FOR DELETE TO authenticated
  USING (true);

-- 5. Verifica la struttura della tabella
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'person_staff_roles'
ORDER BY ordinal_position;

-- 6. Verifica le foreign keys
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'person_staff_roles';

