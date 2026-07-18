-- Tabella memo personali dell'utente (solo visibili a chi li ha creati)
-- Tipi: note, reminder, appointment, todo

CREATE TABLE IF NOT EXISTS user_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('note', 'reminder', 'appointment', 'todo')),
  content TEXT NOT NULL,
  due_date DATE,
  due_time TIME,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per query veloci per user_id
CREATE INDEX IF NOT EXISTS idx_user_memos_user_id ON user_memos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memos_due_date ON user_memos(due_date);
CREATE INDEX IF NOT EXISTS idx_user_memos_type ON user_memos(type);

-- RLS: solo l'utente può vedere/modificare i propri memo
ALTER TABLE user_memos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_memos_select_own" ON user_memos;
CREATE POLICY "user_memos_select_own" ON user_memos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memos_insert_own" ON user_memos;
CREATE POLICY "user_memos_insert_own" ON user_memos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memos_update_own" ON user_memos;
CREATE POLICY "user_memos_update_own" ON user_memos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_memos_delete_own" ON user_memos;
CREATE POLICY "user_memos_delete_own" ON user_memos
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION update_user_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_memos_updated_at ON user_memos;
CREATE TRIGGER user_memos_updated_at
  BEFORE UPDATE ON user_memos
  FOR EACH ROW
  EXECUTE PROCEDURE update_user_memos_updated_at();
