-- Data/ora in cui un todo è stato segnato come completato (per auto-eliminazione dopo 7 giorni)
ALTER TABLE user_memos
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill: todo già completati usano updated_at come riferimento
UPDATE user_memos
SET completed_at = updated_at
WHERE type = 'todo' AND completed = TRUE AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_memos_completed_at ON user_memos(completed_at)
  WHERE type = 'todo' AND completed = TRUE;
