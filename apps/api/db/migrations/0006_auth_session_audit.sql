CREATE TABLE IF NOT EXISTS user_auth_events (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  event_name text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  role text,
  ip inet,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_events_email_created ON user_auth_events(email, created_at DESC);
