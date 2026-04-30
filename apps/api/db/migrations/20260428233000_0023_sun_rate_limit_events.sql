CREATE TABLE IF NOT EXISTS sun_rate_limit_events (
  id bigserial PRIMARY KEY,
  scope text NOT NULL,
  scope_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sun_rate_limit_events_scope_time
  ON sun_rate_limit_events (scope, scope_key, created_at DESC);
