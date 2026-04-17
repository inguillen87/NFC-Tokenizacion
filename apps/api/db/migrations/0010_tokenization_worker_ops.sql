ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS external_ref text;

UPDATE tokenization_requests
SET next_attempt_at = COALESCE(next_attempt_at, requested_at)
WHERE next_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tokenization_requests_next_attempt
  ON tokenization_requests(status, next_attempt_at, requested_at);
