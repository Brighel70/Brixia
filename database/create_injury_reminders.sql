-- Tabella promemoria per infortunio: testo + data/ora notifica (opzionale)
CREATE TABLE IF NOT EXISTS injury_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  injury_id uuid NOT NULL REFERENCES injuries(id) ON DELETE CASCADE,
  content text NOT NULL,
  reminder_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_injury_reminders_injury_id ON injury_reminders(injury_id);
CREATE INDEX IF NOT EXISTS idx_injury_reminders_reminder_at ON injury_reminders(reminder_at) WHERE reminder_at IS NOT NULL;

ALTER TABLE injury_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS injury_reminders_select ON injury_reminders;
CREATE POLICY injury_reminders_select ON injury_reminders FOR SELECT USING (true);

DROP POLICY IF EXISTS injury_reminders_insert ON injury_reminders;
CREATE POLICY injury_reminders_insert ON injury_reminders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS injury_reminders_update ON injury_reminders;
CREATE POLICY injury_reminders_update ON injury_reminders FOR UPDATE USING (true);

DROP POLICY IF EXISTS injury_reminders_delete ON injury_reminders;
CREATE POLICY injury_reminders_delete ON injury_reminders FOR DELETE USING (true);
