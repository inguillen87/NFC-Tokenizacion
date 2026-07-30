-- Durable SDK v1 idempotency and uncertain-write reconciliation.
-- Response bodies are encrypted by the application before persistence; this is
-- required because POS activation responses contain a one-time bearer token.

-- The historical SDK schema was runtime-created. Materialize its prerequisites
-- here so a clean migration-only database does not depend on a request booting
-- the application before this migration runs.
CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'SDK key',
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes jsonb NOT NULL DEFAULT '["sdk:verify","sdk:claim","sdk:products","sdk:events","sdk:pos","sdk:logistics"]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  expires_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdk_pos_activations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  bid text NOT NULL,
  uid_hex text,
  pos_token_prefix text NOT NULL,
  pos_token_hash text NOT NULL UNIQUE,
  external_order_id text,
  retailer_id text,
  contact text,
  activation_status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  used_at timestamptz,
  claim_request_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdk_claim_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  bid text NOT NULL,
  uid_hex text,
  contact text NOT NULL,
  name text,
  claim_status text NOT NULL DEFAULT 'pending_verification',
  pin_validated boolean NOT NULL DEFAULT false,
  active_for_claim boolean NOT NULL DEFAULT false,
  pos_activation_id uuid REFERENCES sdk_pos_activations(id) ON DELETE SET NULL,
  pos_validated boolean NOT NULL DEFAULT false,
  carrier_profile_code text,
  token_id text,
  tx_hash text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdk_external_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  bid text,
  uid_hex text,
  event_type text NOT NULL,
  source text NOT NULL DEFAULT 'sdk',
  occurred_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_api_keys_tenant_status ON tenant_api_keys(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sdk_pos_activations_tenant_created ON sdk_pos_activations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_pos_activations_bid_uid ON sdk_pos_activations(bid, uid_hex);
CREATE INDEX IF NOT EXISTS idx_sdk_claim_requests_tenant_created ON sdk_claim_requests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_claim_requests_bid_uid ON sdk_claim_requests(bid, uid_hex);
CREATE INDEX IF NOT EXISTS idx_sdk_external_events_tenant_created ON sdk_external_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_external_events_type_created ON sdk_external_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_external_events_bid_uid ON sdk_external_events(bid, uid_hex);

CREATE TABLE IF NOT EXISTS sdk_idempotency_operations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES tenant_api_keys(id) ON DELETE SET NULL,
  route text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL DEFAULT 'processing',
  response_status integer,
  response_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_body_ciphertext text,
  resource_id text,
  operation_committed boolean,
  reconciliation_status text NOT NULL DEFAULT 'not_requested',
  reconciliation_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reconciled_at timestamptz,
  trace_id text,
  error_code text,
  lease_token text,
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  CONSTRAINT sdk_idempotency_route_check CHECK (route IN (
    '/api/v1/sdk/verify',
    '/api/v1/sdk/claim',
    '/api/v1/sdk/events',
    '/api/v1/sdk/pos/activate'
  )),
  CONSTRAINT sdk_idempotency_key_length_check CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  CONSTRAINT sdk_idempotency_request_hash_check CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sdk_idempotency_state_check CHECK (state IN ('processing', 'completed', 'failed', 'uncertain')),
  CONSTRAINT sdk_idempotency_reconciliation_status_check CHECK (reconciliation_status IN ('not_requested', 'confirmed', 'not_configured', 'failed')),
  CONSTRAINT sdk_idempotency_response_status_check CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  CONSTRAINT sdk_idempotency_terminal_response_check CHECK (
    state = 'processing'
    OR response_status IS NOT NULL
    OR state = 'uncertain'
  )
);

-- Runtime schema guards may have created the table before the migration runner.
-- Re-apply named constraints explicitly so both deployment orders converge.
ALTER TABLE sdk_idempotency_operations
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS reconciliation_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

ALTER TABLE sdk_idempotency_operations
  DROP CONSTRAINT IF EXISTS sdk_idempotency_route_check,
  DROP CONSTRAINT IF EXISTS sdk_idempotency_key_length_check,
  DROP CONSTRAINT IF EXISTS sdk_idempotency_request_hash_check,
  DROP CONSTRAINT IF EXISTS sdk_idempotency_state_check,
  DROP CONSTRAINT IF EXISTS sdk_idempotency_reconciliation_status_check,
  DROP CONSTRAINT IF EXISTS sdk_idempotency_response_status_check,
  DROP CONSTRAINT IF EXISTS sdk_idempotency_terminal_response_check;

ALTER TABLE sdk_idempotency_operations
  ADD CONSTRAINT sdk_idempotency_route_check CHECK (route IN (
    '/api/v1/sdk/verify',
    '/api/v1/sdk/claim',
    '/api/v1/sdk/events',
    '/api/v1/sdk/pos/activate'
  )),
  ADD CONSTRAINT sdk_idempotency_key_length_check CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  ADD CONSTRAINT sdk_idempotency_request_hash_check CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT sdk_idempotency_state_check CHECK (state IN ('processing', 'completed', 'failed', 'uncertain')),
  ADD CONSTRAINT sdk_idempotency_reconciliation_status_check CHECK (reconciliation_status IN ('not_requested', 'confirmed', 'not_configured', 'failed')),
  ADD CONSTRAINT sdk_idempotency_response_status_check CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  ADD CONSTRAINT sdk_idempotency_terminal_response_check CHECK (
    state = 'processing'
    OR response_status IS NOT NULL
    OR state = 'uncertain'
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_sdk_idempotency_tenant_route_key
  ON sdk_idempotency_operations (tenant_id, route, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_sdk_idempotency_tenant_updated
  ON sdk_idempotency_operations (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sdk_idempotency_processing_lease
  ON sdk_idempotency_operations (lease_expires_at)
  WHERE state = 'processing';

CREATE INDEX IF NOT EXISTS idx_sdk_idempotency_expiry
  ON sdk_idempotency_operations (expires_at);

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sdk_idempotency_operation_id uuid
  REFERENCES sdk_idempotency_operations(id) ON DELETE SET NULL;

ALTER TABLE sdk_claim_requests
  ADD COLUMN IF NOT EXISTS idempotency_operation_id uuid
  REFERENCES sdk_idempotency_operations(id) ON DELETE SET NULL;

ALTER TABLE sdk_external_events
  ADD COLUMN IF NOT EXISTS idempotency_operation_id uuid
  REFERENCES sdk_idempotency_operations(id) ON DELETE SET NULL;

ALTER TABLE sdk_pos_activations
  ADD COLUMN IF NOT EXISTS idempotency_operation_id uuid
  REFERENCES sdk_idempotency_operations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_sdk_idempotency_operation
  -- PostgreSQL requires every unique index on a partitioned table to include
  -- its partition key. The central operation row remains the cross-partition
  -- idempotency authority; this index prevents duplicates within the event
  -- identity while remaining valid for RANGE(created_at).
  ON events (sdk_idempotency_operation_id, created_at)
  WHERE sdk_idempotency_operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sdk_claim_requests_idempotency_operation
  ON sdk_claim_requests (idempotency_operation_id)
  WHERE idempotency_operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sdk_external_events_idempotency_operation
  ON sdk_external_events (idempotency_operation_id)
  WHERE idempotency_operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sdk_pos_activations_idempotency_operation
  ON sdk_pos_activations (idempotency_operation_id)
  WHERE idempotency_operation_id IS NOT NULL;
