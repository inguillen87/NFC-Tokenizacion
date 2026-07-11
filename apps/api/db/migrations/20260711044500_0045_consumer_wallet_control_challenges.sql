CREATE TABLE IF NOT EXISTS consumer_wallet_challenges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  consumer_id uuid NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  chain_id text NOT NULL,
  wallet_network text NOT NULL,
  wallet_provider text NOT NULL DEFAULT 'wallet_evm',
  message text NOT NULL,
  message_hash text NOT NULL,
  signature_hash text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  user_agent_hash text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumer_wallet_challenges_active
  ON consumer_wallet_challenges (consumer_id, created_at DESC)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consumer_wallet_challenges_expiry
  ON consumer_wallet_challenges (expires_at)
  WHERE used_at IS NULL;

UPDATE consumers c
SET wallet_verified_at = NULL,
    updated_at = now()
WHERE c.wallet_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM consumer_identities ci
    WHERE ci.consumer_id = c.id
      AND ci.provider = 'web3_wallet'
      AND lower(ci.provider_subject) = lower(c.wallet_address)
      AND ci.verified_at IS NOT NULL
  );

UPDATE consumers
SET wallet_address = NULL,
    wallet_chain_id = NULL,
    wallet_network = NULL,
    wallet_verified_at = NULL,
    updated_at = now()
WHERE wallet_network = 'presentation';
