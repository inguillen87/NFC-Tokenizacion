ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_address text;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_chain_id text;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_network text;
ALTER TABLE consumers ADD COLUMN IF NOT EXISTS wallet_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_consumers_wallet_address
  ON consumers (lower(wallet_address))
  WHERE wallet_address IS NOT NULL;
