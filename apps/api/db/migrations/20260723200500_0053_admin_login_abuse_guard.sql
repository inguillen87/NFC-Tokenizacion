CREATE TABLE IF NOT EXISTS admin_login_attempt_buckets (
  bucket_kind text NOT NULL,
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_kind, bucket_key),
  CONSTRAINT admin_login_attempt_buckets_kind_check
    CHECK (bucket_kind IN ('source', 'source_subject')),
  CONSTRAINT admin_login_attempt_buckets_key_check
    CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_login_attempt_buckets_count_check
    CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempt_buckets_updated
  ON admin_login_attempt_buckets (updated_at);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempt_buckets_blocked
  ON admin_login_attempt_buckets (blocked_until)
  WHERE blocked_until IS NOT NULL;
