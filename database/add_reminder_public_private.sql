-- Aggiunge supporto promemoria pubblici/privati
-- Pubblico: tutti vedono e possono modificare/eliminare
-- Privato: solo il creatore vede, modifica ed elimina

-- 1. Aggiungi colonne
ALTER TABLE injury_reminders
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 2. I promemoria esistenti restano pubblici (is_public = true, created_by = null)

-- 3. RLS: sostituisci policy per rispettare visibilità
DROP POLICY IF EXISTS injury_reminders_select ON injury_reminders;
CREATE POLICY injury_reminders_select ON injury_reminders
  FOR SELECT USING (
    is_public = true OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS injury_reminders_insert ON injury_reminders;
CREATE POLICY injury_reminders_insert ON injury_reminders
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS injury_reminders_update ON injury_reminders;
CREATE POLICY injury_reminders_update ON injury_reminders
  FOR UPDATE USING (
    is_public = true OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS injury_reminders_delete ON injury_reminders;
CREATE POLICY injury_reminders_delete ON injury_reminders
  FOR DELETE USING (
    is_public = true OR created_by = auth.uid()
  );
