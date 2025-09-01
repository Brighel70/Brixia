-- Crea le policy RLS per la tabella categories
-- Esegui questo script nel tuo database Supabase

-- 1. Policy per permettere SELECT a tutti gli utenti autenticati
CREATE POLICY "Enable read access for authenticated users" ON public.categories
FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Policy per permettere UPDATE a tutti gli utenti autenticati
CREATE POLICY "Enable update access for authenticated users" ON public.categories
FOR UPDATE USING (auth.role() = 'authenticated');

-- 3. Policy per permettere INSERT a tutti gli utenti autenticati
CREATE POLICY "Enable insert access for authenticated users" ON public.categories
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Policy per permettere DELETE a tutti gli utenti autenticati
CREATE POLICY "Enable delete access for authenticated users" ON public.categories
FOR DELETE USING (auth.role() = 'authenticated');

-- 5. Verifica le policy create
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'categories'
ORDER BY policyname;

