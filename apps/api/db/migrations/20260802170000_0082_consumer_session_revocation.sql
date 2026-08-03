-- 0082_consumer_session_revocation
-- Server-side invalidation for consumer logout and account deletion.

ALTER TABLE consumer_sessions
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_consumer_sessions_active
  ON consumer_sessions(consumer_id, expires_at DESC)
  WHERE revoked_at IS NULL;

