import { sql } from "./db";

let schemaReady: Promise<void> | null = null;

async function migrateTokenizationRequestsSchema() {
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tokenization_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id uuid,
      batch_id uuid,
      bid text NOT NULL,
      uid_hex text NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_tokenization_requests_next_attempt
    ON tokenization_requests(status, next_attempt_at, requested_at)
  `;
}

export async function ensureTokenizationRequestsSchema() {
  if (!schemaReady) {
    schemaReady = migrateTokenizationRequestsSchema().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
