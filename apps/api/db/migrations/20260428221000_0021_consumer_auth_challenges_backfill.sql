CREATE TABLE IF NOT EXISTS consumer_auth_challenges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_contact_created
  ON consumer_auth_challenges (contact, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_expires
  ON consumer_auth_challenges (expires_at DESC);
