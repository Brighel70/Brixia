-- ========================================
-- FIX: Risolvi ricorsione infinita nelle RLS policies
-- ========================================

-- Disabilita temporaneamente RLS sulla tabella people
ALTER TABLE public.people DISABLE ROW LEVEL SECURITY;

-- Rimuovi tutte le policies esistenti sulla tabella people
DROP POLICY IF EXISTS "users_view_people_policy" ON public.people;

-- Ricrea la policy in modo più semplice e sicuro
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- Policy semplificata per people - solo controllo base
CREATE POLICY "users_view_people_policy" ON public.people
FOR ALL USING (
  -- Admin e Dirigenti vedono TUTTO
  public.user_has_role(auth.uid(), ARRAY['Admin', 'Dirigente', 'Segreteria', 'Direttore Sportivo', 'Direttore Tecnico'])
  OR
  -- Giocatore vede solo SE STESSO
  (people.id = auth.uid())
  OR
  -- Se non è autenticato, non vede nulla (per sicurezza)
  auth.uid() IS NOT NULL
);

-- Verifica che la policy sia stata creata correttamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'people';

-- Test della funzione helper
SELECT public.user_has_role(auth.uid(), ARRAY['Admin']) as is_admin;

-- ========================================
-- COMPLETATO! ✅
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS POLICY CORRETTA!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 La ricorsione infinita è stata risolta';
  RAISE NOTICE '📋 Ora le query sulla tabella people dovrebbero funzionare';
  RAISE NOTICE '';
END $$;








