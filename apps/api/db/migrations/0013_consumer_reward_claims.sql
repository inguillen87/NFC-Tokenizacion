DO $$ BEGIN
  CREATE TYPE consumer_reward_claim_status AS ENUM ('claimed', 'redeemed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS requires_age_gate boolean NOT NULL DEFAULT false;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS network_visible boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS consumer_reward_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  status consumer_reward_claim_status NOT NULL DEFAULT 'claimed',
  points_spent integer NOT NULL,
  redemption_code text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_reward_claims_consumer ON consumer_reward_claims(consumer_id, created_at DESC);
