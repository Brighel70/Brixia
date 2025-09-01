-- Pulisci il database e usa solo la tabella events
-- Esegui questo script nel tuo database Supabase

-- 1. Rimuovi il campo session_type da sessions (torna a essere solo per allenamenti)
ALTER TABLE public.sessions DROP COLUMN IF EXISTS session_type;

-- 2. Verifica che la tabella events esista e abbia la struttura corretta
-- Se non esiste, creala
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'partita',
  category_id UUID REFERENCES categories(id),
  location TEXT,
  is_home BOOLEAN DEFAULT true,
  opponent TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Aggiungi policy RLS per events
CREATE POLICY "Enable read access for authenticated users" ON public.events
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON public.events
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON public.events
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON public.events
FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Inserisci alcuni eventi di esempio
INSERT INTO public.events (title, event_date, event_type, category_id, location, is_home, opponent, description) VALUES
  ('Partita U14 vs Rugby Milano', '2025-01-15', 'partita', (SELECT id FROM categories WHERE code = 'U14'), 'Brescia', true, 'Rugby Milano', 'Partita di campionato'),
  ('Torneo U12', '2025-01-21', 'torneo', (SELECT id FROM categories WHERE code = 'U12'), 'Milano', false, NULL, 'Torneo regionale U12')
ON CONFLICT DO NOTHING;

-- 5. Verifica la struttura
SELECT 'Sessions table:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sessions' ORDER BY ordinal_position;

SELECT 'Events table:' as info;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'events' ORDER BY ordinal_position;

