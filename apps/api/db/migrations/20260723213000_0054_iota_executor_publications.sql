CREATE TABLE IF NOT EXISTS iota_executor_publications (
  proof_id text PRIMARY KEY,
  request_id text,
  status text NOT NULL CHECK (status IN ('processing', 'submitted', 'confirmed', 'failed')),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_json jsonb,
  tx_hash text,
  nonce bigint,
  block_number bigint,
  block_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_iota_executor_publications_request
  ON iota_executor_publications (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iota_executor_publications_status_updated
  ON iota_executor_publications (status, updated_at);
