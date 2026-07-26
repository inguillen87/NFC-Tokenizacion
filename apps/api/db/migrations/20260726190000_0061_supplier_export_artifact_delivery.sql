-- Persist the encrypted supplier artifact before consuming its one-time export.
-- The password is never stored; only the already-encrypted envelope is retained
-- so an interrupted HTTP delivery can be recovered by an authorized operator.
ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS encrypted_payload_base64 text;
ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'metadata_only';
ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS delivery_attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS last_delivery_attempt_at timestamptz;

ALTER TABLE vault_artifacts DROP CONSTRAINT IF EXISTS vault_artifacts_delivery_status_check;
ALTER TABLE vault_artifacts
  ADD CONSTRAINT vault_artifacts_delivery_status_check
  CHECK (delivery_status IN ('metadata_only', 'ready', 'failed'));

CREATE INDEX IF NOT EXISTS idx_vault_artifacts_supplier_delivery
  ON vault_artifacts (supplier_order_id, artifact_type, delivery_status, created_at DESC);
