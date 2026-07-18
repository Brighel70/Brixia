-- ========================================
-- FIX: Disabilita RLS sulla tabella categories
-- ========================================

-- Le categorie sono dati di configurazione del sistema
-- Devono essere visibili a TUTTI gli utenti

-- Disabilita RLS sulla tabella categories
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Rimuovi eventuali policy esistenti
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_view_policy" ON public.categories;
DROP POLICY IF EXISTS "users_view_categories" ON public.categories;

-- Crea una policy permissiva per SELECT (lettura)
-- Tutti possono leggere le categorie
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_public_read" ON public.categories
FOR SELECT USING (true);

-- Solo admin possono modificare
CREATE POLICY "categories_admin_write" ON public.categories
FOR ALL USING (
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente'])
);

-- Verifica le policy
SELECT 'POLICY CATEGORIES:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'categories';

-- Test: Verifica che le categorie siano accessibili
SELECT 'TEST ACCESSO CATEGORIE:' as info;
SELECT COUNT(*) as total_categories FROM public.categories;
SELECT id, name, code, sort, active FROM public.categories WHERE active = true ORDER BY sort LIMIT 5;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS CATEGORIES RISOLTO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Le categorie sono ora accessibili a tutti';
  RAISE NOTICE '📋 Ricarica la pagina per vedere i checkbox';
  RAISE NOTICE '';
END $$;








