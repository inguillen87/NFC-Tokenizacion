CREATE TABLE IF NOT EXISTS batch_key_material (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_order_id uuid REFERENCES supplier_orders(id) ON DELETE CASCADE,
  supplier_sub_batch_id uuid REFERENCES supplier_sub_batches(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE CASCADE,
  bid text NOT NULL,
  key_role text NOT NULL CHECK (key_role IN ('K_META_BATCH', 'K_FILE_BATCH')),
  key_version integer NOT NULL DEFAULT 1 CHECK (key_version > 0),
  encrypted_key_ct text NOT NULL,
  key_fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked', 'destroyed')),
  export_count integer NOT NULL DEFAULT 0,
  exported_at timestamptz,
  created_by text,
  exported_by text,
  rotated_from_key_id uuid REFERENCES batch_key_material(id) ON DELETE SET NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  rotation_reason text,
  kms_key_id text,
  kms_key_version text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_sub_batch_id, key_role, key_version)
);

ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;
ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS exported_by text;
ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS rotated_at timestamptz;
ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS kms_key_version text;

CREATE INDEX IF NOT EXISTS idx_batch_key_material_batch ON batch_key_material(batch_id, key_role, key_version);
CREATE INDEX IF NOT EXISTS idx_batch_key_material_bid ON batch_key_material(bid, key_role, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_key_material_active_role
  ON batch_key_material(supplier_sub_batch_id, key_role)
  WHERE status = 'active';
