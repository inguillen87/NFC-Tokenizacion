CREATE TABLE IF NOT EXISTS tokenization_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  bid text NOT NULL,
  uid_hex text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  network text NOT NULL DEFAULT 'polygon-amoy',
  asset_ref text,
  issuer_wallet text,
  tx_hash text,
  token_id text,
  anchor_hash text,
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tokenization_requests_bid_uid ON tokenization_requests(bid, uid_hex, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_status ON tokenization_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tenant ON tokenization_requests(tenant_id, requested_at DESC);
