-- Reconcile the legacy supplier runtime tables with the canonical supplier
-- operations contract before migrations 0062+. Some early environments
-- created different, empty placeholder shapes outside the migration ledger.
-- Fail closed if any incompatible table already contains data: this bridge is
-- structural normalization, never an implicit data conversion.

DO $supplier_runtime_bridge_preflight$
DECLARE
  v_incompatible boolean;
BEGIN
  SELECT
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'base_batch_id'
    )
    OR COALESCE((
      SELECT udt_name <> 'text' FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'status'
    ), true)
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'bid'
    )
    OR COALESCE((
      SELECT udt_name <> 'uuid' FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'batch_id'
    ), true)
    OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'batch_keys' AND column_name = 'meta_key_ct'
    )
    OR COALESCE((
      SELECT udt_name <> 'uuid' FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'batch_keys' AND column_name = 'batch_id'
    ), true)
  INTO v_incompatible;

  IF v_incompatible AND (
    EXISTS (SELECT 1 FROM supplier_orders LIMIT 1)
    OR EXISTS (SELECT 1 FROM supplier_sub_batches LIMIT 1)
    OR EXISTS (SELECT 1 FROM batch_keys LIMIT 1)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'supplier_runtime_legacy_shape_contains_data',
      HINT = 'Reconcile legacy supplier rows explicitly before applying the supplier runtime baseline bridge.';
  END IF;
END
$supplier_runtime_bridge_preflight$;

ALTER TABLE supplier_orders
  ADD COLUMN IF NOT EXISTS base_batch_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $supplier_orders_legacy_columns$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'order_code') THEN
    ALTER TABLE supplier_orders ALTER COLUMN order_code DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'supplier_name') THEN
    ALTER TABLE supplier_orders ALTER COLUMN supplier_name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'material_type') THEN
    ALTER TABLE supplier_orders ALTER COLUMN material_type DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_orders' AND column_name = 'status' AND udt_name <> 'text'
  ) THEN
    ALTER TABLE supplier_orders ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE supplier_orders ALTER COLUMN status TYPE text USING status::text;
  END IF;
END
$supplier_orders_legacy_columns$;

ALTER TABLE supplier_orders
  ALTER COLUMN base_batch_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pack_ready';

ALTER TABLE supplier_sub_batches
  ADD COLUMN IF NOT EXISTS bid text,
  ADD COLUMN IF NOT EXISTS expected_quantity integer,
  ADD COLUMN IF NOT EXISTS manifest_hash text,
  ADD COLUMN IF NOT EXISTS manifest_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS key_export_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS key_exported_at timestamptz,
  ADD COLUMN IF NOT EXISTS manifest_imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS qa_passed_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $supplier_sub_batches_legacy_columns$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'batch_id' AND udt_name <> 'uuid'
  ) THEN
    ALTER TABLE supplier_sub_batches ALTER COLUMN batch_id DROP DEFAULT;
    ALTER TABLE supplier_sub_batches ALTER COLUMN batch_id TYPE uuid USING NULLIF(batch_id::text, '')::uuid;
  END IF;
  ALTER TABLE supplier_sub_batches ALTER COLUMN batch_id DROP NOT NULL;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'quantity') THEN
    ALTER TABLE supplier_sub_batches ALTER COLUMN quantity DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'sequence') THEN
    ALTER TABLE supplier_sub_batches ALTER COLUMN sequence DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'chip_model') THEN
    ALTER TABLE supplier_sub_batches ALTER COLUMN chip_model DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'carrier_profile_code') THEN
    ALTER TABLE supplier_sub_batches ALTER COLUMN carrier_profile_code DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_sub_batches' AND column_name = 'material_type') THEN
    ALTER TABLE supplier_sub_batches ALTER COLUMN material_type DROP NOT NULL;
  END IF;
END
$supplier_sub_batches_legacy_columns$;

ALTER TABLE supplier_sub_batches
  ALTER COLUMN bid SET NOT NULL,
  ALTER COLUMN expected_quantity SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pack_ready';

CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_sub_batches_bid
  ON supplier_sub_batches (bid);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_order
  ON supplier_sub_batches (supplier_order_id, sequence_index);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_batch
  ON supplier_sub_batches (batch_id);

DO $supplier_sub_batch_batch_fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_sub_batches_batch_id_fkey') THEN
    ALTER TABLE supplier_sub_batches
      ADD CONSTRAINT supplier_sub_batches_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL;
  END IF;
END
$supplier_sub_batch_batch_fk$;

ALTER TABLE batch_keys
  ADD COLUMN IF NOT EXISTS supplier_order_id uuid,
  ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid,
  ADD COLUMN IF NOT EXISTS bid text,
  ADD COLUMN IF NOT EXISTS meta_key_ct text,
  ADD COLUMN IF NOT EXISTS file_key_ct text,
  ADD COLUMN IF NOT EXISTS key_fingerprint text,
  ADD COLUMN IF NOT EXISTS export_count integer NOT NULL DEFAULT 0;

DO $batch_keys_legacy_columns$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'batch_keys' AND column_name = 'batch_id' AND udt_name <> 'uuid'
  ) THEN
    ALTER TABLE batch_keys ALTER COLUMN batch_id DROP DEFAULT;
    ALTER TABLE batch_keys ALTER COLUMN batch_id TYPE uuid USING NULLIF(batch_id::text, '')::uuid;
  END IF;
  ALTER TABLE batch_keys ALTER COLUMN batch_id DROP NOT NULL;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'batch_keys' AND column_name = 'key_role') THEN
    ALTER TABLE batch_keys ALTER COLUMN key_role DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'batch_keys' AND column_name = 'encrypted_key_ct') THEN
    ALTER TABLE batch_keys ALTER COLUMN encrypted_key_ct DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'batch_keys' AND column_name = 'key_fingerprint_sha256_prefix') THEN
    ALTER TABLE batch_keys ALTER COLUMN key_fingerprint_sha256_prefix DROP NOT NULL;
  END IF;
END
$batch_keys_legacy_columns$;

ALTER TABLE batch_keys
  ALTER COLUMN bid SET NOT NULL,
  ALTER COLUMN meta_key_ct SET NOT NULL,
  ALTER COLUMN file_key_ct SET NOT NULL,
  ALTER COLUMN key_fingerprint SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_keys_bid ON batch_keys (bid);
CREATE INDEX IF NOT EXISTS idx_batch_keys_batch ON batch_keys (batch_id);

DO $batch_keys_foreign_keys$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batch_keys_supplier_order_id_fkey') THEN
    ALTER TABLE batch_keys ADD CONSTRAINT batch_keys_supplier_order_id_fkey
      FOREIGN KEY (supplier_order_id) REFERENCES supplier_orders(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batch_keys_supplier_sub_batch_id_fkey') THEN
    ALTER TABLE batch_keys ADD CONSTRAINT batch_keys_supplier_sub_batch_id_fkey
      FOREIGN KEY (supplier_sub_batch_id) REFERENCES supplier_sub_batches(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'batch_keys_batch_id_fkey') THEN
    ALTER TABLE batch_keys ADD CONSTRAINT batch_keys_batch_id_fkey
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE;
  END IF;
END
$batch_keys_foreign_keys$;
