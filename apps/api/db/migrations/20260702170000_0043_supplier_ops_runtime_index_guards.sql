ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS supplier_order_id uuid;
ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS batch_id uuid;

ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'legacy';
ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS resource_id text NOT NULL DEFAULT 'legacy';
ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'legacy';
ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS resource_id text NOT NULL DEFAULT 'legacy';
ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE supplier_qa_checks ADD COLUMN IF NOT EXISTS bid text NOT NULL DEFAULT 'legacy';
ALTER TABLE supplier_qa_checks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS batch_id uuid;
ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS bid text NOT NULL DEFAULT 'legacy';
ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS key_role text NOT NULL DEFAULT 'K_META_BATCH';
ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;
ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid;

ALTER TABLE offline_verifier_devices ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE offline_verifier_devices ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE offline_verifier_devices ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE offline_verifier_bundles ADD COLUMN IF NOT EXISTS device_id uuid;
ALTER TABLE offline_verifier_bundles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE offline_verifier_bundles ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS bundle_id uuid;
ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS bid text NOT NULL DEFAULT 'legacy';
ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();
