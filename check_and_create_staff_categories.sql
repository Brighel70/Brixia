-- Script per verificare e creare la tabella staff_categories se necessario

-- 1. Verifica se la tabella staff_categories esiste
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'staff_categories' 
  AND table_schema = 'public';

-- 2. Se la tabella non esiste, creala
CREATE TABLE IF NOT EXISTS public.staff_categories (
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_categories_pkey PRIMARY KEY (user_id, category_id),
  CONSTRAINT staff_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT staff_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
);

-- 3. Abilita RLS sulla tabella
ALTER TABLE public.staff_categories ENABLE ROW LEVEL SECURITY;

-- 4. Crea politiche RLS per staff_categories
CREATE POLICY IF NOT EXISTS "staff_categories_select_policy" ON public.staff_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS "staff_categories_insert_policy" ON public.staff_categories
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "staff_categories_update_policy" ON public.staff_categories
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "staff_categories_delete_policy" ON public.staff_categories
  FOR DELETE TO authenticated
  USING (true);

-- 5. Verifica la struttura finale
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'staff_categories'
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
  AND tc.table_name = 'staff_categories';









