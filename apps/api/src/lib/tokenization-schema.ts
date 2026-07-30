import { sql } from "./db";

let schemaReady: Promise<void> | null = null;

export type TokenizationExecutionClass = "legacy_unclassified" | "simulation" | "testnet_trial" | "live_chain";

const TESTNET_NETWORKS = new Set(["polygon-amoy", "ethereum-sepolia", "base-sepolia"]);
const MAINNET_NETWORKS = new Set(["polygon", "ethereum-mainnet", "base-mainnet"]);

/**
 * Classifies a server-approved target network. Caller-supplied execution_class
 * is deliberately ignored by every write route.
 */
export function classifyTokenizationExecutionClass(
  network: unknown,
  options: { simulated?: boolean } = {},
): TokenizationExecutionClass | null {
  const normalized = String(network || "").trim().toLowerCase();
  if (options.simulated === true || normalized === "simulation") return "simulation";
  if (TESTNET_NETWORKS.has(normalized)) return "testnet_trial";
  if (MAINNET_NETWORKS.has(normalized)) return "live_chain";
  return null;
}

export const TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED = "tokenization_commercial_scope_migration_required";
export const TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION =
  "20260729160000_0072_tokenization_marketplace_execution_governance.sql";

export function isTokenizationCommercialScopeSchemaError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = String(candidate?.code || "").trim();
  const message = String(candidate?.message || error || "").toLowerCase();
  return code === "42703"
    || code === "42P01"
    || message.includes("required_schema_migration_not_applied")
    || message.includes("tokenization_commercial_scope_migration_required");
}

async function migrateTokenizationRequestsSchema() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tokenization_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id uuid,
      batch_id uuid,
      tag_id uuid REFERENCES tags(id) ON DELETE RESTRICT,
      source_event_id bigint,
      source_event_created_at timestamptz,
      bid text NOT NULL,
      uid_hex text NOT NULL,
      execution_class text NOT NULL DEFAULT 'legacy_unclassified',
      status text NOT NULL DEFAULT 'pending',
      network text NOT NULL DEFAULT 'polygon-amoy',
      asset_ref text,
      issuer_wallet text,
      tx_hash text,
      token_id text,
      anchor_hash text,
      requested_by text,
      requested_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      attempt_count integer NOT NULL DEFAULT 0,
      last_error text,
      next_attempt_at timestamptz,
      external_ref text,
      meta jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `;

  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS tenant_id uuid`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS batch_id uuid`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES tags(id) ON DELETE RESTRICT`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS source_event_id bigint`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS source_event_created_at timestamptz`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS execution_class text NOT NULL DEFAULT 'legacy_unclassified'`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS network text NOT NULL DEFAULT 'polygon-amoy'`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS asset_ref text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS issuer_wallet text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS tx_hash text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS token_id text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS anchor_hash text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS requested_by text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now()`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS processed_at timestamptz`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS last_error text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS external_ref text`;
  await sql/*sql*/`ALTER TABLE tokenization_requests ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb`;

  // Legacy demo rows used to be stored as anchored with generated hashes.
  // Normalize them before any public or admin surface can present them as
  // blockchain evidence.
  await sql/*sql*/`
    UPDATE tokenization_requests
    SET status = 'simulated',
        network = 'simulation',
        tx_hash = NULL,
        token_id = NULL,
        anchor_hash = NULL,
        external_ref = COALESCE(NULLIF(external_ref, ''), 'simulation:legacy-normalized'),
        meta = COALESCE(meta, '{}'::jsonb) || '{"legacy_simulation_normalized":true}'::jsonb
    WHERE status = 'anchored'
      AND lower(COALESCE(meta->>'simulated', 'false')) = 'true'
  `;

  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_bid_uid
    ON tokenization_requests(bid, uid_hex, requested_at DESC)
  `;
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_status
    ON tokenization_requests(status, requested_at DESC)
  `;
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tenant
    ON tokenization_requests(tenant_id, requested_at DESC)
  `;
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tenant_asset
    ON tokenization_requests(tenant_id, batch_id, uid_hex, requested_at DESC)
  `;
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tag_event
    ON tokenization_requests(tenant_id, tag_id, source_event_id, source_event_created_at, requested_at DESC)
  `;
  await sql/*sql*/`
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_next_attempt
    ON tokenization_requests(status, next_attempt_at, requested_at)
  `;
}

export async function ensureTokenizationRequestsSchema() {
  const production = [process.env.VERCEL_ENV, process.env.NODE_ENV]
    .some((value) => String(value || "").trim().toLowerCase() === "production");
  if (production) {
    // Production/serverless request paths are migration consumers, never
    // schema owners. This is a read-only, fail-closed readiness check.
    return ensureTokenizationCommercialScopeSchema();
  }
  if (!schemaReady) {
    schemaReady = migrateTokenizationRequestsSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function ensureTokenizationCommercialScopeSchema() {
  // This gate deliberately performs no compatibility DDL. A request path must
  // never be able to manufacture just enough columns to bypass the migration
  // that owns the constraints, triggers and atomic execution function.
  const rows = await sql/*sql*/`
    SELECT
      EXISTS (
        SELECT 1
        FROM schema_migrations
        WHERE id = ${TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION}
      ) AS migration_applied,
      to_regprocedure(
        'public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)'
      ) IS NOT NULL AS prepare_function_ready,
      has_function_privilege(
        current_user,
        'public.nexid_prepare_tokenization_execution_v1(uuid,uuid,uuid,text,integer)',
        'EXECUTE'
      ) AS prepare_execute_ready,
      EXISTS (
        SELECT 1
        FROM pg_trigger trigger_row
        WHERE trigger_row.tgname = 'trg_nexid_tokenization_execution_scope_v1'
          AND trigger_row.tgrelid = 'public.tokenization_requests'::regclass
          AND trigger_row.tgenabled <> 'D'
          AND NOT trigger_row.tgisinternal
      ) AS execution_guard_ready,
      to_regclass('public.uq_tokenization_request_asset_execution') IS NOT NULL
        AS execution_uniqueness_ready,
      (
        SELECT count(*) = 8
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'tokenization_requests'
          AND column_name IN (
            'tag_id',
            'source_event_id',
            'source_event_created_at',
            'execution_class',
            'lease_id',
            'lease_owner',
            'lease_acquired_at',
            'lease_expires_at'
          )
      ) AS columns_ready
  `;
  const gate = rows[0];
  if (
    gate?.migration_applied !== true
    || gate?.prepare_function_ready !== true
    || gate?.prepare_execute_ready !== true
    || gate?.execution_guard_ready !== true
    || gate?.execution_uniqueness_ready !== true
    || gate?.columns_ready !== true
  ) {
    throw new Error(TOKENIZATION_COMMERCIAL_SCOPE_MIGRATION_REQUIRED);
  }
}
