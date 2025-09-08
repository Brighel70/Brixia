-- Script per creare la tabella council_members
-- Questa tabella gestisce i membri del consiglio per gli eventi consiglio

CREATE TABLE IF NOT EXISTS public.council_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('president', 'vice_president', 'counselor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggiungi commenti per chiarezza
COMMENT ON TABLE public.council_members IS 'Tabella per gestire i membri del consiglio (Presidente, Vice Presidente, Consiglieri)';
COMMENT ON COLUMN public.council_members.name IS 'Nome completo del membro del consiglio';
COMMENT ON COLUMN public.council_members.role IS 'Ruolo: president, vice_president, counselor';

-- Crea un indice per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_council_members_role ON public.council_members(role);

-- Abilita RLS (Row Level Security)
ALTER TABLE public.council_members ENABLE ROW LEVEL SECURITY;

-- Crea policy per permettere a tutti gli utenti autenticati di leggere i membri del consiglio
CREATE POLICY "Allow authenticated users to read council members" ON public.council_members
  FOR SELECT USING (auth.role() = 'authenticated');

-- Crea policy per permettere solo agli amministratori di modificare i membri del consiglio
CREATE POLICY "Allow admins to manage council members" ON public.council_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'amministratore'
    )
  );

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_council_members_updated_at 
  BEFORE UPDATE ON public.council_members 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();











