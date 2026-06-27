CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'production_registered';
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'active_in_market';
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'deprecating';
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'archived';

CREATE TABLE IF NOT EXISTS supplier_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_slug text NOT NULL,
  order_name text NOT NULL,
  base_batch_id text NOT NULL,
  total_quantity integer NOT NULL CHECK (total_quantity > 0),
  sub_batch_size integer NOT NULL CHECK (sub_batch_size > 0),
  chip_model text NOT NULL,
  carrier_profile_code text NOT NULL,
  material_type text,
  notes text,
  status text NOT NULL DEFAULT 'pack_ready',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_sub_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  bid text NOT NULL UNIQUE,
  sequence_index integer NOT NULL,
  expected_quantity integer NOT NULL CHECK (expected_quantity > 0),
  manifest_count integer NOT NULL DEFAULT 0,
  manifest_hash text,
  manifest_status text NOT NULL DEFAULT 'pending',
  qa_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'pack_ready',
  key_export_count integer NOT NULL DEFAULT 0,
  key_exported_at timestamptz,
  manifest_imported_at timestamptz,
  qa_passed_at timestamptz,
  activated_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_order_id, sequence_index)
);

CREATE TABLE IF NOT EXISTS batch_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_order_id uuid REFERENCES supplier_orders(id) ON DELETE CASCADE,
  supplier_sub_batch_id uuid REFERENCES supplier_sub_batches(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  bid text NOT NULL,
  meta_key_ct text NOT NULL,
  file_key_ct text NOT NULL,
  key_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  export_count integer NOT NULL DEFAULT 0,
  exported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid)
);

CREATE TABLE IF NOT EXISTS vault_artifacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_order_id uuid REFERENCES supplier_orders(id) ON DELETE CASCADE,
  supplier_sub_batch_id uuid REFERENCES supplier_sub_batches(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  artifact_type text NOT NULL,
  content_hash text NOT NULL,
  mime_type text,
  storage_ref text,
  status text NOT NULL DEFAULT 'active',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_qa_checks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_order_id uuid REFERENCES supplier_orders(id) ON DELETE CASCADE,
  supplier_sub_batch_id uuid REFERENCES supplier_sub_batches(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  bid text NOT NULL,
  status text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  replay_checked boolean NOT NULL DEFAULT false,
  ttstatus_checked boolean NOT NULL DEFAULT false,
  notes text,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_providers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL,
  network text NOT NULL,
  rpc_url_env_name text,
  chain_id text,
  enabled boolean NOT NULL DEFAULT false,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, network)
);

CREATE TABLE IF NOT EXISTS evidence_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  event_type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_anchors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  network text NOT NULL,
  anchor_type text NOT NULL DEFAULT 'merkle_root',
  merkle_root text NOT NULL,
  event_count integer NOT NULL,
  event_hashes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  tx_hash text,
  explorer_url text,
  status text NOT NULL DEFAULT 'local',
  anchored_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_order_id uuid;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS expected_quantity integer;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS manifest_status text NOT NULL DEFAULT 'pending';
ALTER TABLE batches ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'pending';
ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS supplier_order_id uuid;
ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid;
ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS expected_quantity integer;

CREATE INDEX IF NOT EXISTS idx_supplier_orders_tenant_created ON supplier_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_order ON supplier_sub_batches(supplier_order_id, sequence_index);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_batch ON supplier_sub_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_keys_batch ON batch_keys(batch_id);
CREATE INDEX IF NOT EXISTS idx_vault_artifacts_resource ON vault_artifacts(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_qa_checks_bid ON supplier_qa_checks(bid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_events_resource ON evidence_events(resource_type, resource_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_events_tenant_created ON evidence_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_anchors_tenant_created ON evidence_anchors(tenant_id, created_at DESC);

INSERT INTO ledger_providers (code, network, rpc_url_env_name, chain_id, enabled, metadata_json)
VALUES
  ('none', 'local', null, null, true, '{"purpose":"local proof without external ledger"}'::jsonb),
  ('polygon', 'amoy', 'POLYGON_RPC_URL', '80002', false, '{"purpose":"ownership certificates and claim proofs"}'::jsonb),
  ('iota', 'testnet', 'IOTA_EVM_RPC_URL', null, false, '{"purpose":"optional enterprise audit trail; testnet can reset"}'::jsonb)
ON CONFLICT (code, network) DO UPDATE SET
  rpc_url_env_name = EXCLUDED.rpc_url_env_name,
  chain_id = EXCLUDED.chain_id,
  metadata_json = ledger_providers.metadata_json || EXCLUDED.metadata_json,
  updated_at = now();
