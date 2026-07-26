CREATE TABLE IF NOT EXISTS sun_rate_limit_buckets (
  scope text NOT NULL,
  scope_key_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  hit_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, scope_key_hash),
  CONSTRAINT sun_rate_limit_buckets_scope_check
    CHECK (scope ~ '^[a-z0-9:_-]{1,80}$'),
  CONSTRAINT sun_rate_limit_buckets_key_check
    CHECK (scope_key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sun_rate_limit_buckets_count_check
    CHECK (hit_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sun_rate_limit_buckets_updated
  ON sun_rate_limit_buckets (updated_at);
