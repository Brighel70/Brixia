-- Script per correggere la tabella notes esistente
-- Esegui questo script nel tuo database Supabase

-- ========================================
-- CORREZIONE TABELLA NOTES
-- ========================================

-- 1. Prima verifichiamo se la tabella esiste e la sua struttura
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'notes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Se la tabella esiste ma ha il vincolo sbagliato, rimuoviamolo
DO $$ 
BEGIN
    -- Controlla se esiste il vincolo sbagliato (che punta a profiles)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notes_person_id_fkey' 
        AND table_name = 'notes'
    ) THEN
        -- Rimuovi il vincolo esistente
        ALTER TABLE public.notes DROP CONSTRAINT notes_person_id_fkey;
        
        -- Crea il vincolo corretto che punta a people
        ALTER TABLE public.notes 
        ADD CONSTRAINT notes_person_id_fkey 
        FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Vincolo corretto da profiles a people';
    ELSE
        RAISE NOTICE 'Vincolo già corretto o non esistente';
    END IF;
END $$;

-- 3. Se la tabella non esiste, creala
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'note',
  created_by text NOT NULL DEFAULT 'Sistema',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE
);

-- 4. Crea indici per performance (se non esistono)
CREATE INDEX IF NOT EXISTS idx_notes_person_id ON public.notes(person_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON public.notes(created_at);

-- 5. Abilita RLS (se non è già abilitato)
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- 6. Rimuovi la politica esistente se c'è (per evitare conflitti)
DROP POLICY IF EXISTS "Note gestibili da staff autenticato" ON public.notes;

-- 7. Crea la politica corretta
CREATE POLICY "Note gestibili da staff autenticato" ON public.notes
  FOR ALL USING (auth.role() = 'authenticated');

-- 8. Aggiungi commenti per documentazione
COMMENT ON TABLE public.notes IS 'Note e commenti associati alle persone';
COMMENT ON COLUMN public.notes.person_id IS 'ID della persona di riferimento (tabella people)';
COMMENT ON COLUMN public.notes.content IS 'Contenuto della nota';
COMMENT ON COLUMN public.notes.type IS 'Tipo di nota (note, medical, etc.)';
COMMENT ON COLUMN public.notes.created_by IS 'Autore della nota';

-- 9. Verifica la struttura finale
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'notes' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 10. Verifica i vincoli
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'notes';

-- 11. Verifica le politiche RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'notes';


