CREATE TABLE IF NOT EXISTS offline_verifier_devices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_label text NOT NULL,
  device_type text NOT NULL DEFAULT 'field_app',
  device_fingerprint text NOT NULL,
  operator_ref text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'disabled')),
  last_seen_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS offline_verifier_bundles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES offline_verifier_devices(id) ON DELETE CASCADE,
  bundle_ref text NOT NULL UNIQUE,
  allowed_bids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_fingerprints_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  bundle_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  issued_by text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offline_scan_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES offline_verifier_devices(id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES offline_verifier_bundles(id) ON DELETE CASCADE,
  client_event_id text NOT NULL,
  bid text NOT NULL,
  uid_hash text,
  sun_payload_hash text,
  local_verdict text NOT NULL CHECK (local_verdict IN ('OFFLINE_LOCAL_PASS', 'OFFLINE_LOCAL_FAIL', 'SYNC_PENDING')),
  sync_status text NOT NULL DEFAULT 'received' CHECK (sync_status IN ('received', 'duplicate', 'rejected')),
  server_verdict text NOT NULL DEFAULT 'SYNC_PENDING',
  reason text,
  payload_hash text NOT NULL,
  observed_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, device_id, client_event_id)
);

CREATE INDEX IF NOT EXISTS idx_offline_verifier_devices_tenant ON offline_verifier_devices(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offline_verifier_bundles_device ON offline_verifier_bundles(device_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_offline_scan_events_bundle ON offline_scan_events(bundle_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_offline_scan_events_bid ON offline_scan_events(tenant_id, bid, received_at DESC);
