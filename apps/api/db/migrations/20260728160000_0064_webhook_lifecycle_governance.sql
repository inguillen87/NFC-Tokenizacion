-- Durable tenant-webhook lifecycle and application-layer secret rotation.
-- The runner owns the transaction boundary. Ciphertext columns are software
-- envelope encryption and must not be represented as KMS or HSM custody.

ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reactivated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signing_secret_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signing_secret_fingerprint text,
  ADD COLUMN IF NOT EXISTS signing_secret_previous text,
  ADD COLUMN IF NOT EXISTS signing_secret_previous_version integer,
  ADD COLUMN IF NOT EXISTS signing_secret_previous_fingerprint text,
  ADD COLUMN IF NOT EXISTS signing_secret_previous_valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS signing_secret_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS signing_secret_rotated_by uuid REFERENCES users(id) ON DELETE SET NULL;

UPDATE webhook_endpoints
SET signing_secret_version = CASE
  WHEN NULLIF(signing_secret, '') IS NULL THEN 0
  ELSE GREATEST(signing_secret_version, 1)
END
WHERE signing_secret_version = 0;

UPDATE webhook_endpoints
SET enabled = false,
    disabled_at = COALESCE(disabled_at, deleted_at)
WHERE deleted_at IS NOT NULL
  AND enabled = true;

ALTER TABLE webhook_endpoints
  DROP CONSTRAINT IF EXISTS webhook_endpoints_secret_version_check,
  DROP CONSTRAINT IF EXISTS webhook_endpoints_previous_secret_state_check,
  DROP CONSTRAINT IF EXISTS webhook_endpoints_previous_secret_window_check,
  DROP CONSTRAINT IF EXISTS webhook_endpoints_deleted_disabled_check;

ALTER TABLE webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_secret_version_check
    CHECK (signing_secret_version >= 0),
  ADD CONSTRAINT webhook_endpoints_previous_secret_state_check
    CHECK (
      (
        signing_secret_previous IS NULL
        AND signing_secret_previous_version IS NULL
        AND signing_secret_previous_fingerprint IS NULL
        AND signing_secret_previous_valid_until IS NULL
      ) OR (
        signing_secret_previous IS NOT NULL
        AND signing_secret_previous_version IS NOT NULL
        AND signing_secret_previous_fingerprint IS NOT NULL
        AND signing_secret_previous_valid_until IS NOT NULL
        AND signing_secret_previous_version >= 0
        AND signing_secret_previous_version < signing_secret_version
      )
    ),
  ADD CONSTRAINT webhook_endpoints_previous_secret_window_check
    CHECK (
      signing_secret_previous_valid_until IS NULL
      OR signing_secret_previous_valid_until <= COALESCE(signing_secret_rotated_at, updated_at) + interval '24 hours'
    ),
  ADD CONSTRAINT webhook_endpoints_deleted_disabled_check
    CHECK (deleted_at IS NULL OR enabled = false);

-- Prevent tenant or endpoint deletion from cascading through retained webhook
-- evidence. Lifecycle changes must use the audited soft-delete contract.
ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_endpoint_id_fkey;

ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_endpoint_id_fkey
  FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE webhook_deliveries
  VALIDATE CONSTRAINT webhook_deliveries_endpoint_id_fkey;

ALTER TABLE webhook_endpoints
  DROP CONSTRAINT IF EXISTS webhook_endpoints_tenant_id_fkey;

ALTER TABLE webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE webhook_endpoints
  VALIDATE CONSTRAINT webhook_endpoints_tenant_id_fkey;

CREATE TABLE IF NOT EXISTS webhook_endpoint_audit_events (
  id bigserial PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  secret_version integer,
  secret_fingerprint text,
  previous_secret_version integer,
  previous_secret_fingerprint text,
  overlap_valid_until timestamptz,
  request_id text,
  ip_address text,
  user_agent text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_endpoint_audit_event_type_check CHECK (event_type IN (
    'webhook_endpoint_created',
    'webhook_endpoint_updated',
    'webhook_endpoint_disabled',
    'webhook_endpoint_reactivated',
    'webhook_endpoint_deleted',
    'webhook_secret_rotated'
  )),
  CONSTRAINT webhook_endpoint_audit_secret_version_check CHECK (
    secret_version IS NULL OR secret_version >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant_lifecycle
  ON webhook_endpoints(tenant_id, deleted_at, enabled, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoint_audit_endpoint_created
  ON webhook_endpoint_audit_events(endpoint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoint_audit_tenant_created
  ON webhook_endpoint_audit_events(tenant_id, created_at DESC);
