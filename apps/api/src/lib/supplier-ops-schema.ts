import { sql } from "./db";

let supplierOpsSchemaReady: Promise<void> | null = null;

function resetSupplierOpsSchema() {
  supplierOpsSchemaReady = null;
}

async function ensureUuidExtensions() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
}

async function ensureBatchStatusValues() {
  await sql/*sql*/`ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'draft'`;
  await sql/*sql*/`ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'production_registered'`;
  await sql/*sql*/`ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'active_in_market'`;
  await sql/*sql*/`ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'deprecating'`;
  await sql/*sql*/`ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'archived'`;
}

export async function ensureSupplierOpsSchema() {
  if (!supplierOpsSchemaReady) {
    supplierOpsSchemaReady = (async () => {
      await ensureUuidExtensions();
      await ensureBatchStatusValues();

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS evidence_events (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          resource_type text NOT NULL,
          resource_id text NOT NULL,
          event_type text NOT NULL,
          payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          payload_hash text NOT NULL UNIQUE,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS evidence_anchors (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          provider text NOT NULL,
          network text NOT NULL,
          anchor_type text NOT NULL DEFAULT 'merkle_root',
          resource_type text,
          resource_id text,
          merkle_root text NOT NULL,
          event_count integer NOT NULL,
          event_hashes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          tx_hash text,
          explorer_url text,
          status text NOT NULL DEFAULT 'local',
          anchored_at timestamptz,
          error_message text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`
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
        )
      `;

      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_order_id uuid`;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid`;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS expected_quantity integer`;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS manifest_status text NOT NULL DEFAULT 'pending'`;
      await sql/*sql*/`ALTER TABLE batches ADD COLUMN IF NOT EXISTS qa_status text NOT NULL DEFAULT 'pending'`;
      await sql/*sql*/`ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS supplier_order_id uuid`;
      await sql/*sql*/`ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid`;
      await sql/*sql*/`ALTER TABLE tenant_manifests ADD COLUMN IF NOT EXISTS expected_quantity integer`;
      await sql/*sql*/`ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS tenant_id uuid`;
      await sql/*sql*/`ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS supplier_order_id uuid`;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS batch_id uuid`;
      await sql/*sql*/`ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS resource_type text`;
      await sql/*sql*/`ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS resource_id text`;
      await sql/*sql*/`ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS event_hashes_json jsonb NOT NULL DEFAULT '[]'::jsonb`;
      await sql/*sql*/`ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS tenant_id uuid`;
      await sql/*sql*/`ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS tenant_id uuid`;
      await sql/*sql*/`ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS resource_id text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE evidence_events ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS resource_type text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS resource_id text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE vault_artifacts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE supplier_qa_checks ADD COLUMN IF NOT EXISTS bid text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE supplier_qa_checks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ADD COLUMN IF NOT EXISTS sequence_index integer`;
      await sql/*sql*/`
        WITH numbered_sub_batches AS (
          SELECT
            id,
            row_number() OVER (PARTITION BY supplier_order_id ORDER BY created_at ASC, id ASC)::integer AS generated_sequence_index
          FROM supplier_sub_batches
          WHERE sequence_index IS NULL
        )
        UPDATE supplier_sub_batches ssb
        SET sequence_index = numbered_sub_batches.generated_sequence_index
        FROM numbered_sub_batches
        WHERE ssb.id = numbered_sub_batches.id
      `;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ALTER COLUMN sequence_index SET DEFAULT 1`;
      await sql/*sql*/`ALTER TABLE supplier_sub_batches ALTER COLUMN sequence_index SET NOT NULL`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS created_by text`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS exported_by text`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS rotated_at timestamptz`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS revoked_at timestamptz`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS kms_key_version text`;
      await sql/*sql*/`ALTER TABLE batch_keys ADD COLUMN IF NOT EXISTS batch_id uuid`;
      await sql/*sql*/`ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS batch_id uuid`;
      await sql/*sql*/`ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS bid text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS key_role text NOT NULL DEFAULT 'K_META_BATCH'`;
      await sql/*sql*/`ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1`;
      await sql/*sql*/`ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
      await sql/*sql*/`ALTER TABLE batch_key_material ADD COLUMN IF NOT EXISTS supplier_sub_batch_id uuid`;
      await sql/*sql*/`ALTER TABLE offline_verifier_devices ADD COLUMN IF NOT EXISTS tenant_id uuid`;
      await sql/*sql*/`ALTER TABLE offline_verifier_devices ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
      await sql/*sql*/`ALTER TABLE offline_verifier_devices ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE offline_verifier_bundles ADD COLUMN IF NOT EXISTS device_id uuid`;
      await sql/*sql*/`ALTER TABLE offline_verifier_bundles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`;
      await sql/*sql*/`ALTER TABLE offline_verifier_bundles ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS bundle_id uuid`;
      await sql/*sql*/`ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS tenant_id uuid`;
      await sql/*sql*/`ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS bid text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE offline_scan_events ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now()`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS code text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Proof provider'`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'legacy'`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS rpc_url_env_name text`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS chain_id text`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'Proof provider'`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql/*sql*/`ALTER TABLE ledger_providers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;

      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_supplier_orders_tenant_created ON supplier_orders(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_order ON supplier_sub_batches(supplier_order_id, sequence_index)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_batch ON supplier_sub_batches(batch_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_batch_keys_batch ON batch_keys(batch_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_batch_key_material_batch ON batch_key_material(batch_id, key_role, key_version)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_batch_key_material_bid ON batch_key_material(bid, key_role, status)`;
      await sql/*sql*/`CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_key_material_active_role ON batch_key_material(supplier_sub_batch_id, key_role) WHERE status = 'active'`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_vault_artifacts_resource ON vault_artifacts(resource_type, resource_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_supplier_qa_checks_bid ON supplier_qa_checks(bid, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_evidence_events_resource ON evidence_events(resource_type, resource_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_evidence_events_tenant_created ON evidence_events(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_evidence_anchors_tenant_created ON evidence_anchors(tenant_id, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_offline_verifier_devices_tenant ON offline_verifier_devices(tenant_id, status, created_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_offline_verifier_bundles_device ON offline_verifier_bundles(device_id, status, expires_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_offline_scan_events_bundle ON offline_scan_events(bundle_id, received_at DESC)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_offline_scan_events_bid ON offline_scan_events(tenant_id, bid, received_at DESC)`;

      const ledgerProviderSeeds = [
        { code: "none", name: "Local proof", network: "local", rpcEnv: null, chainId: null, enabled: true, purpose: "local proof without external ledger" },
        { code: "polygon", name: "Polygon Amoy", network: "amoy", rpcEnv: "POLYGON_RPC_URL", chainId: "80002", enabled: false, purpose: "ownership certificates and claim proofs" },
        { code: "iota", name: "IOTA testnet", network: "testnet", rpcEnv: "IOTA_EVM_RPC_URL", chainId: null, enabled: false, purpose: "optional enterprise audit trail; testnet can reset" },
      ] as const;

      for (const provider of ledgerProviderSeeds) {
        const metadataJson = JSON.stringify({ purpose: provider.purpose });
        await sql/*sql*/`
          UPDATE ledger_providers
          SET
            name = ${provider.name},
            network = ${provider.network},
            rpc_url_env_name = ${provider.rpcEnv},
            chain_id = ${provider.chainId},
            enabled = ${provider.enabled},
            purpose = ${provider.purpose},
            metadata_json = COALESCE(metadata_json, '{}'::jsonb) || ${metadataJson}::jsonb,
            updated_at = now()
          WHERE code = ${provider.code}
        `;
        await sql/*sql*/`
          INSERT INTO ledger_providers (code, name, network, rpc_url_env_name, chain_id, enabled, purpose, metadata_json)
          SELECT ${provider.code}, ${provider.name}, ${provider.network}, ${provider.rpcEnv}, ${provider.chainId}, ${provider.enabled}, ${provider.purpose}, ${metadataJson}::jsonb
          WHERE NOT EXISTS (
            SELECT 1 FROM ledger_providers WHERE code = ${provider.code}
          )
        `;
      }
    })().catch((error) => {
      resetSupplierOpsSchema();
      throw error;
    });
  }
  return supplierOpsSchemaReady;
}
