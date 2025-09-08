-- STEP H: RLS & permessi (accenno operativo)
-- Migrazione sicura per Supabase - Non elimina nulla esistente

-- Abilita RLS sulle nuove tabelle
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Regole minime per people
CREATE POLICY "Admin can do everything on people" ON public.people
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'Admin'
    )
  );

CREATE POLICY "Staff can view people in their categories" ON public.people
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_categories sc
      JOIN public.player_categories pc ON pc.category_id = sc.category_id
      JOIN public.players pl ON pl.id = pc.player_id
      WHERE sc.user_id = auth.uid() 
      AND pl.person_id = people.id
    )
  );

CREATE POLICY "People can view/edit their own data" ON public.people
  FOR ALL USING (id IN (
    SELECT person_id FROM public.profiles WHERE id = auth.uid()
    UNION
    SELECT person_id FROM public.players WHERE person_id = people.id
  ));

-- Regole per guardians
CREATE POLICY "Admin can do everything on guardians" ON public.guardians
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'Admin'
    )
  );

CREATE POLICY "Guardians can view their relationships" ON public.guardians
  FOR SELECT USING (
    guardian_person_id IN (
      SELECT person_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Regole per medical_certificates
CREATE POLICY "Admin can do everything on medical_certificates" ON public.medical_certificates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'Admin'
    )
  );

CREATE POLICY "Staff can view medical certificates" ON public.medical_certificates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff_categories sc
      JOIN public.player_categories pc ON pc.category_id = sc.category_id
      JOIN public.players pl ON pl.id = pc.player_id
      WHERE sc.user_id = auth.uid() 
      AND pl.person_id = medical_certificates.person_id
    )
  );

-- Regole per person_consents
CREATE POLICY "Admin can do everything on person_consents" ON public.person_consents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'Admin'
    )
  );

-- Regole per documents
CREATE POLICY "Admin can do everything on documents" ON public.documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() 
      AND p.role = 'Admin'
    )
  );

CREATE POLICY "Staff can view documents based on visibility" ON public.documents
  FOR SELECT USING (
    visibility IN ('staff', 'owner_only', 'owner_guardians') AND
    EXISTS (
      SELECT 1 FROM public.staff_categories sc
      JOIN public.player_categories pc ON pc.category_id = sc.category_id
      JOIN public.players pl ON pl.id = pc.player_id
      WHERE sc.user_id = auth.uid() 
      AND pl.person_id = documents.person_id
    )
  );






