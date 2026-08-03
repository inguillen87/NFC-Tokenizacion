import { sql } from "./db";
import type { SunPayloadHashes } from "./sun-payload.ts";

export type RegisteredSunPayloadMatch = {
  payloadId: string;
  tagId: string | null;
  uidHex: string;
  payloadStatus: string;
  tagStatus: string | null;
  lifecycleState: string | null;
  lifecycleRevision: number;
  carrierProfileCode: string | null;
};

let ensured = false;

export async function ensureTagSunPayloadSchema() {
  if (ensured) return;
  await sql/*sql*/`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS tag_sun_payloads (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
      uid_hex text NOT NULL,
      bid text NOT NULL,
      raw_url_hash text,
      picc_data_hash text NOT NULL,
      enc_hash text NOT NULL,
      cmac_hash text NOT NULL,
      source text NOT NULL DEFAULT 'supplier_manifest',
      status text NOT NULL DEFAULT 'active',
      raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (batch_id, raw_url_hash),
      UNIQUE (batch_id, picc_data_hash, cmac_hash)
    )
  `;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tag_sun_payloads_uid ON tag_sun_payloads(batch_id, UPPER(uid_hex))`;
  await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_tag_sun_payloads_hashes ON tag_sun_payloads(batch_id, picc_data_hash, enc_hash, cmac_hash)`;
  ensured = true;
}

export async function upsertTagSunPayload(input: {
  tenantId: string;
  batchId: string;
  bid: string;
  tagId?: string | null;
  uidHex: string;
  hashes: SunPayloadHashes;
  source?: string;
  registrationMetadata?: {
    diagnosticId?: string | null;
    tenantSlug?: string | null;
    hasUrl?: boolean;
  };
}) {
  await ensureTagSunPayloadSchema();
  const registrationMetadata = {
    schema_version: "sun-payload-registration/v1",
    raw_values_persisted: false,
    diagnostic_id: input.registrationMetadata?.diagnosticId || null,
    tenant_slug: input.registrationMetadata?.tenantSlug || null,
    has_url: Boolean(input.registrationMetadata?.hasUrl),
  };
  const rows = await sql/*sql*/`
    INSERT INTO tag_sun_payloads (
      tenant_id, batch_id, tag_id, uid_hex, bid, raw_url_hash, picc_data_hash, enc_hash, cmac_hash, source, status, raw_payload
    ) VALUES (
      ${input.tenantId},
      ${input.batchId},
      ${input.tagId || null},
      ${input.uidHex},
      ${input.bid},
      ${input.hashes.rawUrlHash},
      ${input.hashes.piccDataHash},
      ${input.hashes.encHash},
      ${input.hashes.cmacHash},
      ${input.source || "supplier_manifest"},
      'active',
      ${JSON.stringify(registrationMetadata)}::jsonb
    )
    ON CONFLICT (batch_id, picc_data_hash, cmac_hash)
    DO UPDATE SET
      tag_id = COALESCE(EXCLUDED.tag_id, tag_sun_payloads.tag_id),
      uid_hex = EXCLUDED.uid_hex,
      raw_url_hash = EXCLUDED.raw_url_hash,
      enc_hash = EXCLUDED.enc_hash,
      source = EXCLUDED.source,
      status = 'active',
      raw_payload = EXCLUDED.raw_payload,
      updated_at = now()
    WHERE tag_sun_payloads.tenant_id = EXCLUDED.tenant_id
      AND UPPER(TRIM(tag_sun_payloads.uid_hex)) = UPPER(TRIM(EXCLUDED.uid_hex))
      AND UPPER(TRIM(tag_sun_payloads.bid)) = UPPER(TRIM(EXCLUDED.bid))
      AND (
        tag_sun_payloads.tag_id IS NULL
        OR EXCLUDED.tag_id IS NULL
        OR tag_sun_payloads.tag_id = EXCLUDED.tag_id
      )
    RETURNING id
  `;
  return rows[0] || null;
}

export async function findRegisteredSunPayload(input: {
  batchId: string;
  hashes: SunPayloadHashes;
  ensureSchema?: boolean;
}): Promise<RegisteredSunPayloadMatch | null> {
  if (input.ensureSchema !== false) await ensureTagSunPayloadSchema();
  const rows = await sql/*sql*/`
    SELECT
      p.id AS payload_id,
      p.tag_id,
      p.uid_hex,
      p.status AS payload_status,
      t.status AS tag_status,
      t.lifecycle_state,
      COALESCE(t.lifecycle_revision, 0)::bigint AS lifecycle_revision,
      t.carrier_profile_code
    FROM tag_sun_payloads p
    LEFT JOIN tags t ON t.id = p.tag_id OR (t.batch_id = p.batch_id AND UPPER(t.uid_hex) = UPPER(p.uid_hex))
    WHERE p.batch_id = ${input.batchId}
      AND p.status = 'active'
      AND (
        p.raw_url_hash = ${input.hashes.rawUrlHash}
        OR (p.picc_data_hash = ${input.hashes.piccDataHash} AND p.cmac_hash = ${input.hashes.cmacHash})
        OR (p.picc_data_hash = ${input.hashes.piccDataHash} AND p.enc_hash = ${input.hashes.encHash})
      )
    ORDER BY p.updated_at DESC
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    payloadId: String(row.payload_id),
    tagId: row.tag_id ? String(row.tag_id) : null,
    uidHex: String(row.uid_hex || "").toUpperCase(),
    payloadStatus: String(row.payload_status || "active"),
    tagStatus: row.tag_status ? String(row.tag_status) : null,
    lifecycleState: row.lifecycle_state ? String(row.lifecycle_state) : null,
    lifecycleRevision: Number(row.lifecycle_revision || 0),
    carrierProfileCode: row.carrier_profile_code ? String(row.carrier_profile_code) : null,
  };
}
