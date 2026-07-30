import { sql } from "./db";
import { stableJson } from "./proof-layer";

export type Gs1DigitalLinkIdentity = {
  gtin: string;
  lot: string;
  serial: string;
};

export type Gs1RegistryRecord = Gs1DigitalLinkIdentity & {
  id: string;
  tenantId: string;
  tenantSlug: string;
  batchId: string;
  bid: string;
  tagId: string | null;
  status: "active" | "suspended" | "retired";
  entitlementId: string;
  displayName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const GS1_GTIN_PREFIX_VERIFICATION_METHODS = [
  "verified_by_gs1",
  "gs1_license_document",
  "brand_authorization",
  "pilot_contract_review",
] as const;

export type Gs1GtinPrefixVerificationMethod = typeof GS1_GTIN_PREFIX_VERIFICATION_METHODS[number];

export type Gs1GtinPrefixEntitlementRecord = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  canonicalGtinPrefix: string;
  status: "active" | "revoked";
  verificationMethod: Gs1GtinPrefixVerificationMethod;
  evidenceReference: string;
  createdAt: string;
  updatedAt: string;
};

const QUALIFIER_RE = /^[\x21-\x7e]{1,20}$/;
const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const BID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const UID_RE = /^[0-9A-F]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CURSOR_RE = /^[A-Za-z0-9_-]+$/;

export class Gs1RegistryError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: unknown;

  constructor(code: string, status = 400, detail?: unknown) {
    super(code);
    this.name = "Gs1RegistryError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function clean(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function isValidGtin14(value: unknown) {
  const gtin = clean(value);
  if (!/^\d{14}$/.test(gtin)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) {
    sum += Number(gtin[index]) * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(gtin[13]);
}

function validQualifier(value: string) {
  return value === "" || (QUALIFIER_RE.test(value) && !/[\/?#]/.test(value));
}

export function normalizeGs1Identity(input: {
  gtin?: unknown;
  lot?: unknown;
  serial?: unknown;
}): Gs1DigitalLinkIdentity {
  const identity = {
    gtin: clean(input.gtin),
    lot: clean(input.lot),
    serial: clean(input.serial),
  };
  if (!isValidGtin14(identity.gtin)) throw new Gs1RegistryError("gs1_gtin_invalid", 400);
  if (!validQualifier(identity.lot)) throw new Gs1RegistryError("gs1_lot_invalid", 400);
  if (!validQualifier(identity.serial)) throw new Gs1RegistryError("gs1_serial_invalid", 400);
  return identity;
}

export function gs1IdentityKey(identity: Gs1DigitalLinkIdentity) {
  return `${identity.gtin}\u0000${identity.lot}\u0000${identity.serial}`;
}

export function parseGs1DigitalLinkUri(value: unknown): Gs1DigitalLinkIdentity {
  const raw = clean(value);
  if (!raw || raw.length > 2048) throw new Gs1RegistryError("epcis_identifier_invalid", 400);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Gs1RegistryError("epcis_identifier_invalid", 400);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Gs1RegistryError("epcis_identifier_invalid", 400);
  }
  const parts = parsed.pathname.split("/").filter(Boolean).map(clean);
  if (parts[0] !== "01" || !parts[1]) throw new Gs1RegistryError("epcis_identifier_profile_unsupported", 422);
  let lot = "";
  let serial = "";
  let index = 2;
  while (index < parts.length) {
    const qualifier = parts[index];
    const valuePart = parts[index + 1];
    if (!valuePart || (qualifier !== "10" && qualifier !== "21")) {
      throw new Gs1RegistryError("epcis_identifier_profile_unsupported", 422);
    }
    if (qualifier === "10") {
      if (lot) throw new Gs1RegistryError("epcis_identifier_invalid", 400);
      lot = valuePart;
    } else {
      if (serial) throw new Gs1RegistryError("epcis_identifier_invalid", 400);
      serial = valuePart;
    }
    index += 2;
  }
  return normalizeGs1Identity({ gtin: parts[1], lot, serial });
}

function record(row: Record<string, unknown>): Gs1RegistryRecord {
  return {
    id: String(row.id || ""),
    tenantId: String(row.tenant_id || ""),
    tenantSlug: String(row.tenant_slug || ""),
    batchId: String(row.batch_id || ""),
    bid: String(row.bid || ""),
    tagId: row.tag_id ? String(row.tag_id) : null,
    gtin: String(row.gtin || ""),
    lot: String(row.lot || ""),
    serial: String(row.serial || ""),
    status: String(row.status || "active") as Gs1RegistryRecord["status"],
    entitlementId: String(row.entitlement_id || ""),
    displayName: row.display_name ? String(row.display_name) : null,
    metadata: row.metadata_json && typeof row.metadata_json === "object" && !Array.isArray(row.metadata_json)
      ? row.metadata_json as Record<string, unknown>
      : {},
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function entitlementRecord(row: Record<string, unknown>): Gs1GtinPrefixEntitlementRecord {
  return {
    id: String(row.id || ""),
    tenantId: String(row.tenant_id || ""),
    tenantSlug: String(row.tenant_slug || ""),
    canonicalGtinPrefix: String(row.canonical_gtin_prefix || ""),
    status: String(row.status || "active") as Gs1GtinPrefixEntitlementRecord["status"],
    verificationMethod: String(row.verification_method || "") as Gs1GtinPrefixVerificationMethod,
    evidenceReference: String(row.evidence_reference || ""),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export function normalizeGs1GtinPrefixEntitlementGrant(input: {
  tenantSlug?: unknown;
  canonicalGtinPrefix?: unknown;
  verificationMethod?: unknown;
  evidenceReference?: unknown;
  reason?: unknown;
}) {
  const tenantSlug = clean(input.tenantSlug).toLowerCase();
  const canonicalGtinPrefix = clean(input.canonicalGtinPrefix);
  const verificationMethod = clean(input.verificationMethod).toLowerCase();
  const evidenceReference = String(input.evidenceReference ?? "").trim();
  const reason = String(input.reason ?? "").trim();
  if (!TENANT_SLUG_RE.test(tenantSlug)) throw new Gs1RegistryError("gs1_tenant_invalid", 400);
  if (!/^\d{4,14}$/.test(canonicalGtinPrefix)) {
    throw new Gs1RegistryError("gs1_gtin_prefix_invalid", 400);
  }
  if (!(GS1_GTIN_PREFIX_VERIFICATION_METHODS as readonly string[]).includes(verificationMethod)) {
    throw new Gs1RegistryError("gs1_gtin_prefix_verification_method_invalid", 400);
  }
  if (evidenceReference.length < 3 || evidenceReference.length > 512 || /[\x00-\x1f\x7f]/.test(evidenceReference)) {
    throw new Gs1RegistryError("gs1_gtin_prefix_evidence_reference_invalid", 400);
  }
  if (reason.length < 3 || reason.length > 1000) {
    throw new Gs1RegistryError("gs1_reason_invalid", 400);
  }
  return {
    tenantSlug,
    canonicalGtinPrefix,
    verificationMethod: verificationMethod as Gs1GtinPrefixVerificationMethod,
    evidenceReference,
    reason,
  };
}

export async function resolveTenantGtinPrefixEntitlement(tenantSlugInput: unknown, gtinInput: unknown) {
  const tenantSlug = clean(tenantSlugInput).toLowerCase();
  const gtin = clean(gtinInput);
  if (!TENANT_SLUG_RE.test(tenantSlug)) throw new Gs1RegistryError("gs1_tenant_invalid", 400);
  if (!isValidGtin14(gtin)) throw new Gs1RegistryError("gs1_gtin_invalid", 400);
  const rows = await sql/*sql*/`
    SELECT entitlement.id::text AS id, entitlement.tenant_id::text AS tenant_id,
      tenant.slug AS tenant_slug, entitlement.canonical_gtin_prefix,
      entitlement.status, entitlement.verification_method,
      entitlement.evidence_reference, entitlement.created_at, entitlement.updated_at
    FROM gs1_gtin_prefix_entitlements entitlement
    JOIN tenants tenant ON tenant.id = entitlement.tenant_id
    WHERE tenant.slug = ${tenantSlug}
      AND entitlement.status = 'active'
      AND ${gtin} LIKE entitlement.canonical_gtin_prefix || '%'
    ORDER BY char_length(entitlement.canonical_gtin_prefix) DESC, entitlement.id
    LIMIT 2
  ` as Array<Record<string, unknown>>;
  if (rows.length > 1) throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_ambiguous", 503);
  return rows[0] ? entitlementRecord(rows[0]) : null;
}

export async function grantGs1GtinPrefixEntitlement(input: {
  tenantSlug?: unknown;
  canonicalGtinPrefix?: unknown;
  verificationMethod?: unknown;
  evidenceReference?: unknown;
  actorUserId: string;
  reason?: unknown;
}) {
  const grant = normalizeGs1GtinPrefixEntitlementGrant(input);
  try {
    const rows = await sql/*sql*/`
      WITH tenant_target AS MATERIALIZED (
        SELECT tenant.id, tenant.slug
        FROM tenants tenant
        WHERE tenant.slug = ${grant.tenantSlug}
        LIMIT 1
      ), inserted AS (
        INSERT INTO gs1_gtin_prefix_entitlements (
          tenant_id, canonical_gtin_prefix, verification_method,
          evidence_reference, created_by_user_id
        )
        SELECT tenant_target.id, ${grant.canonicalGtinPrefix}, ${grant.verificationMethod},
          ${grant.evidenceReference}, ${input.actorUserId}::uuid
        FROM tenant_target
        ON CONFLICT (canonical_gtin_prefix) DO NOTHING
        RETURNING *, false AS replayed
      ), selected AS (
        SELECT inserted.* FROM inserted
        UNION ALL
        SELECT existing.*, true AS replayed
        FROM gs1_gtin_prefix_entitlements existing
        WHERE existing.canonical_gtin_prefix = ${grant.canonicalGtinPrefix}
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1
      ), audit AS (
        INSERT INTO gs1_gtin_prefix_entitlement_audit (
          entitlement_id, tenant_id, action, actor_user_id, reason, snapshot_json
        )
        SELECT selected.id, selected.tenant_id, 'granted', ${input.actorUserId}::uuid,
          ${grant.reason}, jsonb_build_object(
            'canonical_gtin_prefix', selected.canonical_gtin_prefix,
            'status', selected.status,
            'verification_method', selected.verification_method,
            'evidence_reference', selected.evidence_reference
          )
        FROM selected
        WHERE selected.replayed = false
        RETURNING entitlement_id
      )
      SELECT selected.id::text AS id, selected.tenant_id::text AS tenant_id,
        tenant.slug AS tenant_slug, selected.canonical_gtin_prefix,
        selected.status, selected.verification_method, selected.evidence_reference,
        selected.created_at, selected.updated_at, selected.replayed,
        (SELECT count(*)::int FROM audit) AS audit_count
      FROM selected
      JOIN tenants tenant ON tenant.id = selected.tenant_id
    ` as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) throw new Gs1RegistryError("gs1_tenant_not_found", 404);
    const entitlement = entitlementRecord(row);
    const replayed = Boolean(row.replayed);
    if (replayed && (
      entitlement.tenantSlug !== grant.tenantSlug
      || entitlement.status !== "active"
      || entitlement.verificationMethod !== grant.verificationMethod
      || entitlement.evidenceReference !== grant.evidenceReference
    )) {
      throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_conflict", 409);
    }
    return { entitlement, replayed };
  } catch (error) {
    if (error instanceof Gs1RegistryError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/gs1_gtin_prefix_entitlement_overlap/i.test(message)) {
      throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_overlap", 409);
    }
    if (/duplicate key|unique constraint/i.test(message)) {
      throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_conflict", 409);
    }
    throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_write_unavailable", 503);
  }
}

export async function listGs1GtinPrefixEntitlements(input: {
  tenantSlug?: unknown;
  status?: unknown;
  limit: number;
  cursor?: unknown;
}) {
  const tenantSlug = clean(input.tenantSlug).toLowerCase();
  const status = clean(input.status).toLowerCase();
  if (tenantSlug && !TENANT_SLUG_RE.test(tenantSlug)) throw new Gs1RegistryError("gs1_tenant_invalid", 400);
  if (status && status !== "active" && status !== "revoked") {
    throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_status_invalid", 400);
  }
  const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 200);
  const cursor = decodeGs1RegistryCursor(input.cursor);
  const fetchLimit = limit + 1;
  const rows = await sql/*sql*/`
    SELECT entitlement.id::text AS id, entitlement.tenant_id::text AS tenant_id,
      tenant.slug AS tenant_slug, entitlement.canonical_gtin_prefix,
      entitlement.status, entitlement.verification_method,
      entitlement.evidence_reference, entitlement.created_at, entitlement.updated_at
    FROM gs1_gtin_prefix_entitlements entitlement
    JOIN tenants tenant ON tenant.id = entitlement.tenant_id
    WHERE (${tenantSlug} = '' OR tenant.slug = ${tenantSlug})
      AND (${status} = '' OR entitlement.status = ${status})
      AND (
        ${cursor?.updatedAt || ""} = ''
        OR entitlement.updated_at < ${cursor?.updatedAt || null}::timestamptz
        OR (entitlement.updated_at = ${cursor?.updatedAt || null}::timestamptz AND entitlement.id < ${cursor?.id || null}::uuid)
      )
    ORDER BY entitlement.updated_at DESC, entitlement.id DESC
    LIMIT ${fetchLimit}
  ` as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const entitlements = rows.slice(0, limit).map(entitlementRecord);
  const last = entitlements.at(-1);
  return {
    entitlements,
    nextCursor: hasMore && last
      ? encodeGs1RegistryCursor({ updatedAt: last.updatedAt, id: last.id })
      : null,
  };
}

export async function revokeGs1GtinPrefixEntitlement(input: {
  entitlementId?: unknown;
  expectedStatus?: unknown;
  actorUserId: string;
  reason?: unknown;
}) {
  const entitlementId = clean(input.entitlementId).toLowerCase();
  const expectedStatus = clean(input.expectedStatus).toLowerCase();
  const reason = String(input.reason ?? "").trim();
  if (!UUID_RE.test(entitlementId)) throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_id_invalid", 400);
  if (expectedStatus !== "active") {
    throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_expected_status_invalid", 400);
  }
  if (reason.length < 3 || reason.length > 1000) throw new Gs1RegistryError("gs1_reason_invalid", 400);
  try {
    const rows = await sql/*sql*/`
      WITH target AS MATERIALIZED (
        SELECT entitlement.*
        FROM gs1_gtin_prefix_entitlements entitlement
        WHERE entitlement.id = ${entitlementId}::uuid
        FOR UPDATE OF entitlement
      ), updated AS (
        UPDATE gs1_gtin_prefix_entitlements entitlement
        SET status = 'revoked', updated_at = now()
        FROM target
        WHERE entitlement.id = target.id
          AND target.status = ${expectedStatus}
        RETURNING entitlement.*, target.status AS previous_status
      ), audit AS (
        INSERT INTO gs1_gtin_prefix_entitlement_audit (
          entitlement_id, tenant_id, action, actor_user_id, reason, snapshot_json
        )
        SELECT updated.id, updated.tenant_id, 'status_changed', ${input.actorUserId}::uuid,
          ${reason}, jsonb_build_object(
            'canonical_gtin_prefix', updated.canonical_gtin_prefix,
            'previous_status', updated.previous_status,
            'status', updated.status
          )
        FROM updated
        RETURNING entitlement_id
      ), decision AS (
        SELECT updated.*, false AS replayed FROM updated
        UNION ALL
        SELECT target.*, target.status AS previous_status, true AS replayed
        FROM target
        WHERE target.status = 'revoked'
          AND NOT EXISTS (SELECT 1 FROM updated)
      )
      SELECT decision.id::text AS id, decision.tenant_id::text AS tenant_id,
        tenant.slug AS tenant_slug, decision.canonical_gtin_prefix,
        decision.status, decision.verification_method, decision.evidence_reference,
        decision.created_at, decision.updated_at, decision.replayed,
        (SELECT count(*)::int FROM audit) AS audit_count
      FROM decision
      JOIN tenants tenant ON tenant.id = decision.tenant_id
    ` as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_not_found", 404);
    return { entitlement: entitlementRecord(row), replayed: Boolean(row.replayed) };
  } catch (error) {
    if (error instanceof Gs1RegistryError) throw error;
    throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_write_unavailable", 503);
  }
}

export async function resolveActiveGs1Identity(input: Gs1DigitalLinkIdentity) {
  const identity = normalizeGs1Identity(input);
  const rows = await sql/*sql*/`
    SELECT identity.id::text AS id, identity.tenant_id::text AS tenant_id,
      tenant.slug AS tenant_slug, identity.batch_id::text AS batch_id,
      batch.bid, identity.tag_id::text AS tag_id, identity.gtin, identity.lot,
      identity.serial, identity.status, identity.entitlement_id::text AS entitlement_id,
      identity.display_name,
      identity.metadata_json, identity.created_at, identity.updated_at
    FROM gs1_digital_link_identities identity
    JOIN tenants tenant ON tenant.id = identity.tenant_id
    JOIN batches batch ON batch.id = identity.batch_id
    JOIN gs1_gtin_prefix_entitlements entitlement
      ON entitlement.id = identity.entitlement_id
     AND entitlement.tenant_id = identity.tenant_id
     AND entitlement.status = 'active'
     AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
    WHERE identity.gtin = ${identity.gtin}
      AND identity.lot = ${identity.lot}
      AND identity.serial = ${identity.serial}
      AND identity.status = 'active'
    LIMIT 2
  ` as Array<Record<string, unknown>>;
  if (rows.length > 1) throw new Gs1RegistryError("gs1_registry_ambiguous", 503);
  return rows[0] ? record(rows[0]) : null;
}

export async function resolveTenantGs1Identities(
  tenantId: string,
  identities: readonly Gs1DigitalLinkIdentity[],
) {
  const unique = [...new Map(identities.map((identity) => {
    const normalized = normalizeGs1Identity(identity);
    return [gs1IdentityKey(normalized), normalized];
  })).values()];
  if (!unique.length || unique.length > 100) throw new Gs1RegistryError("epcis_identifier_count_invalid", 413);
  const rows = await sql/*sql*/`
    WITH requested AS (
      SELECT * FROM jsonb_to_recordset(${JSON.stringify(unique)}::jsonb)
        AS candidate(gtin text, lot text, serial text)
    )
    SELECT identity.id::text AS id, identity.tenant_id::text AS tenant_id,
      tenant.slug AS tenant_slug, identity.batch_id::text AS batch_id,
      batch.bid, identity.tag_id::text AS tag_id, identity.gtin, identity.lot,
      identity.serial, identity.status, identity.entitlement_id::text AS entitlement_id,
      identity.display_name,
      identity.metadata_json, identity.created_at, identity.updated_at
    FROM requested
    JOIN gs1_digital_link_identities identity
      ON identity.gtin = requested.gtin
     AND identity.lot = requested.lot
     AND identity.serial = requested.serial
     AND identity.tenant_id = ${tenantId}::uuid
     AND identity.status = 'active'
    JOIN tenants tenant ON tenant.id = identity.tenant_id
    JOIN batches batch ON batch.id = identity.batch_id
    JOIN gs1_gtin_prefix_entitlements entitlement
      ON entitlement.id = identity.entitlement_id
     AND entitlement.tenant_id = identity.tenant_id
     AND entitlement.status = 'active'
     AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
  ` as Array<Record<string, unknown>>;
  const resolved = new Map(rows.map((row) => {
    const item = record(row);
    return [gs1IdentityKey(item), item];
  }));
  const missing = unique.filter((identity) => !resolved.has(gs1IdentityKey(identity)));
  if (missing.length) {
    throw new Gs1RegistryError("epcis_unknown_gs1_identity", 422, {
      missing: missing.map(({ gtin, lot, serial }) => ({ gtin, lot, serial })),
    });
  }
  return resolved;
}

function parseMetadata(value: unknown) {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Gs1RegistryError("gs1_metadata_invalid", 400);
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > 16 * 1024) {
    throw new Gs1RegistryError("gs1_metadata_too_large", 413);
  }
  return value as Record<string, unknown>;
}

export async function registerGs1Identity(input: {
  tenantSlug: unknown;
  bid: unknown;
  uidHex?: unknown;
  gtin?: unknown;
  lot?: unknown;
  serial?: unknown;
  displayName?: unknown;
  metadata?: unknown;
  actorUserId: string;
  reason?: unknown;
}) {
  const tenantSlug = clean(input.tenantSlug).toLowerCase();
  const bid = clean(input.bid);
  const uidHex = clean(input.uidHex).toUpperCase();
  const displayName = clean(input.displayName);
  const reason = clean(input.reason);
  const identity = normalizeGs1Identity(input);
  const metadata = parseMetadata(input.metadata);
  if (!TENANT_SLUG_RE.test(tenantSlug)) throw new Gs1RegistryError("gs1_tenant_invalid", 400);
  if (!BID_RE.test(bid)) throw new Gs1RegistryError("gs1_bid_invalid", 400);
  if (uidHex && !UID_RE.test(uidHex)) throw new Gs1RegistryError("gs1_uid_invalid", 400);
  if (displayName.length > 240) throw new Gs1RegistryError("gs1_display_name_invalid", 400);
  if (reason.length < 3 || reason.length > 1000) throw new Gs1RegistryError("gs1_reason_invalid", 400);

  try {
    const entitlement = await resolveTenantGtinPrefixEntitlement(tenantSlug, identity.gtin);
    if (!entitlement) throw new Gs1RegistryError("gs1_gtin_prefix_entitlement_required", 403);
    const rows = await sql/*sql*/`
      WITH target AS MATERIALIZED (
        SELECT tenant.id AS tenant_id, entitlement.id AS entitlement_id,
          batch.id AS batch_id, tag.id AS tag_id
        FROM tenants tenant
        JOIN gs1_gtin_prefix_entitlements entitlement
          ON entitlement.id = ${entitlement.id}::uuid
         AND entitlement.tenant_id = tenant.id
         AND entitlement.status = 'active'
         AND ${identity.gtin} LIKE entitlement.canonical_gtin_prefix || '%'
        JOIN batches batch ON batch.tenant_id = tenant.id AND batch.bid = ${bid}
        LEFT JOIN tags tag
          ON tag.batch_id = batch.id
         AND ${uidHex} <> ''
         AND upper(tag.uid_hex) = ${uidHex}
        WHERE tenant.slug = ${tenantSlug}
          AND (${uidHex} = '' OR tag.id IS NOT NULL)
        LIMIT 1
      ), inserted AS (
        INSERT INTO gs1_digital_link_identities (
          tenant_id, entitlement_id, batch_id, tag_id, gtin, lot, serial,
          display_name, metadata_json, created_by_user_id
        )
        SELECT target.tenant_id, target.entitlement_id, target.batch_id, target.tag_id,
          ${identity.gtin}, ${identity.lot}, ${identity.serial},
          ${displayName || null}, ${JSON.stringify(metadata)}::jsonb, ${input.actorUserId}::uuid
        FROM target
        ON CONFLICT (tenant_id, gtin, lot, serial) DO NOTHING
        RETURNING *
      ), selected AS (
        SELECT inserted.*, false AS replayed FROM inserted
        UNION ALL
        SELECT existing.*, true AS replayed
        FROM gs1_digital_link_identities existing
        JOIN target ON target.tenant_id = existing.tenant_id
        WHERE existing.gtin = ${identity.gtin}
          AND existing.lot = ${identity.lot}
          AND existing.serial = ${identity.serial}
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1
      ), audit AS (
        INSERT INTO gs1_digital_link_identity_audit (
          identity_id, tenant_id, action, actor_user_id, reason, snapshot_json
        )
        SELECT selected.id, selected.tenant_id, 'registered', ${input.actorUserId}::uuid,
          ${reason}, jsonb_build_object(
            'gtin', selected.gtin, 'lot', selected.lot, 'serial', selected.serial,
            'batch_id', selected.batch_id, 'tag_id', selected.tag_id,
            'entitlement_id', selected.entitlement_id,
            'status', selected.status
          )
        FROM selected
        WHERE selected.replayed = false
      )
      SELECT selected.*, tenant.slug AS tenant_slug, batch.bid,
        target.batch_id::text AS requested_batch_id,
        target.tag_id::text AS requested_tag_id,
        target.entitlement_id::text AS requested_entitlement_id
      FROM selected
      JOIN target ON target.tenant_id = selected.tenant_id
      JOIN tenants tenant ON tenant.id = selected.tenant_id
      JOIN batches batch ON batch.id = selected.batch_id
    ` as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) throw new Gs1RegistryError("gs1_batch_or_tag_not_found", 404);
    const result = record(row);
    const replayed = Boolean(row.replayed);
    const semanticConflict = result.batchId !== String(row.requested_batch_id || "")
      || result.tagId !== (row.requested_tag_id ? String(row.requested_tag_id) : null)
      || result.status !== "active"
      || result.entitlementId !== String(row.requested_entitlement_id || "")
      || result.displayName !== (displayName || null)
      || stableJson(result.metadata) !== stableJson(metadata);
    if (replayed && semanticConflict) {
      throw new Gs1RegistryError("gs1_identity_conflict", 409);
    }
    return { identity: result, replayed };
  } catch (error) {
    if (error instanceof Gs1RegistryError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/uq_gs1_identity_public_path|duplicate key/i.test(message)) {
      throw new Gs1RegistryError("gs1_identity_owned_by_another_tenant", 409);
    }
    throw new Gs1RegistryError("gs1_registry_write_unavailable", 503);
  }
}

export async function listGs1Identities(input: {
  tenantSlug: string;
  limit: number;
  gtin?: string;
  cursor?: string;
}) {
  const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 200);
  const gtin = clean(input.gtin);
  if (gtin && !isValidGtin14(gtin)) throw new Gs1RegistryError("gs1_gtin_invalid", 400);
  const cursor = decodeGs1RegistryCursor(input.cursor);
  const fetchLimit = limit + 1;
  const rows = await sql/*sql*/`
    SELECT identity.id::text AS id, identity.tenant_id::text AS tenant_id,
      tenant.slug AS tenant_slug, identity.batch_id::text AS batch_id,
      batch.bid, identity.tag_id::text AS tag_id, identity.gtin, identity.lot,
      identity.serial, identity.status, identity.entitlement_id::text AS entitlement_id,
      identity.display_name, entitlement.status AS entitlement_status,
      identity.metadata_json, identity.created_at, identity.updated_at
    FROM gs1_digital_link_identities identity
    JOIN tenants tenant ON tenant.id = identity.tenant_id
    JOIN batches batch ON batch.id = identity.batch_id
    LEFT JOIN gs1_gtin_prefix_entitlements entitlement
      ON entitlement.id = identity.entitlement_id
     AND entitlement.tenant_id = identity.tenant_id
    WHERE tenant.slug = ${input.tenantSlug}
      AND (${gtin} = '' OR identity.gtin = ${gtin})
      AND (
        ${cursor?.updatedAt || ""} = ''
        OR identity.updated_at < ${cursor?.updatedAt || null}::timestamptz
        OR (identity.updated_at = ${cursor?.updatedAt || null}::timestamptz AND identity.id < ${cursor?.id || null}::uuid)
      )
    ORDER BY identity.updated_at DESC, identity.id DESC
    LIMIT ${fetchLimit}
  ` as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const identities = rows.slice(0, limit).map((row) => {
    const identity = record(row);
    const entitlementStatus = row.entitlement_status === "active" || row.entitlement_status === "revoked"
      ? row.entitlement_status
      : null;
    return {
      ...identity,
      entitlementStatus,
      effectiveStatus: entitlementStatus === "active"
        ? identity.status
        : entitlementStatus === "revoked"
          ? "entitlement_revoked"
          : "entitlement_missing",
    };
  });
  const last = identities.at(-1);
  return {
    identities,
    nextCursor: hasMore && last
      ? encodeGs1RegistryCursor({ updatedAt: last.updatedAt, id: last.id })
      : null,
  };
}

type Gs1RegistryCursor = { updatedAt: string; id: string };

export function encodeGs1RegistryCursor(cursor: Gs1RegistryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeGs1RegistryCursor(value: unknown): Gs1RegistryCursor | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 512 || !CURSOR_RE.test(raw)) throw new Gs1RegistryError("gs1_cursor_invalid", 400);
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const updatedAt = String(parsed?.updatedAt || "");
    const date = new Date(updatedAt);
    const id = String(parsed?.id || "");
    if (!updatedAt || !Number.isFinite(date.getTime()) || !UUID_RE.test(id)) throw new Error("invalid");
    return { updatedAt: date.toISOString(), id };
  } catch {
    throw new Gs1RegistryError("gs1_cursor_invalid", 400);
  }
}

export async function updateGs1IdentityStatus(input: {
  tenantSlug: unknown;
  identityId: unknown;
  expectedStatus: unknown;
  status: unknown;
  actorUserId: string;
  reason: unknown;
}) {
  const tenantSlug = clean(input.tenantSlug).toLowerCase();
  const identityId = clean(input.identityId).toLowerCase();
  const expectedStatus = clean(input.expectedStatus).toLowerCase();
  const status = clean(input.status).toLowerCase();
  const reason = clean(input.reason);
  const allowedStatuses = new Set(["active", "suspended", "retired"]);
  if (!TENANT_SLUG_RE.test(tenantSlug)) throw new Gs1RegistryError("gs1_tenant_invalid", 400);
  if (!UUID_RE.test(identityId)) throw new Gs1RegistryError("gs1_identity_id_invalid", 400);
  if (!allowedStatuses.has(expectedStatus) || !allowedStatuses.has(status)) {
    throw new Gs1RegistryError("gs1_status_invalid", 400);
  }
  if (reason.length < 3 || reason.length > 1000) throw new Gs1RegistryError("gs1_reason_invalid", 400);

  try {
    const rows = await sql/*sql*/`
      WITH target AS MATERIALIZED (
        SELECT identity.*
        FROM gs1_digital_link_identities identity
        JOIN tenants tenant ON tenant.id = identity.tenant_id
        WHERE identity.id = ${identityId}::uuid
          AND tenant.slug = ${tenantSlug}
        FOR UPDATE OF identity
      ), updated AS (
        UPDATE gs1_digital_link_identities identity
        SET status = ${status}, updated_at = now()
        FROM target
        WHERE identity.id = target.id
          AND target.status = ${expectedStatus}
          AND target.status <> ${status}
          AND (
            (target.status = 'active' AND ${status} IN ('suspended', 'retired'))
            OR (target.status = 'suspended' AND ${status} IN ('active', 'retired'))
          )
        RETURNING identity.id, identity.tenant_id, target.status AS previous_status
      ), audit AS (
        INSERT INTO gs1_digital_link_identity_audit (
          identity_id, tenant_id, action, actor_user_id, reason, snapshot_json
        )
        SELECT updated.id, updated.tenant_id, 'status_changed', ${input.actorUserId}::uuid,
          ${reason}, jsonb_build_object(
            'previous_status', updated.previous_status,
            'status', ${status}
          )
        FROM updated
        RETURNING identity_id
      ), decision AS (
        SELECT updated.id, updated.previous_status, false AS replayed, 'updated'::text AS outcome
        FROM updated
        UNION ALL
        SELECT target.id, target.status, true, 'replayed'
        FROM target
        WHERE target.status = ${status}
          AND NOT EXISTS (SELECT 1 FROM updated)
        UNION ALL
        SELECT target.id, target.status, false, 'conflict'
        FROM target
        WHERE target.status <> ${status}
          AND NOT EXISTS (SELECT 1 FROM updated)
      )
      SELECT identity.id::text AS id, identity.tenant_id::text AS tenant_id,
        tenant.slug AS tenant_slug, identity.batch_id::text AS batch_id,
        batch.bid, identity.tag_id::text AS tag_id, identity.gtin, identity.lot,
        identity.serial, identity.status, identity.entitlement_id::text AS entitlement_id,
        identity.display_name,
        identity.metadata_json, identity.created_at, identity.updated_at,
        decision.previous_status, decision.replayed, decision.outcome
      FROM decision
      JOIN gs1_digital_link_identities identity ON identity.id = decision.id
      JOIN tenants tenant ON tenant.id = identity.tenant_id
      JOIN batches batch ON batch.id = identity.batch_id
    ` as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) throw new Gs1RegistryError("gs1_identity_not_found", 404);
    if (row.outcome === "conflict") {
      throw new Gs1RegistryError("gs1_status_conflict", 409, {
        currentStatus: String(row.status),
        expectedStatus,
        requestedStatus: status,
      });
    }
    return {
      identity: record(row),
      previousStatus: String(row.previous_status),
      replayed: Boolean(row.replayed),
    };
  } catch (error) {
    if (error instanceof Gs1RegistryError) throw error;
    const message = error instanceof Error ? error.message : "";
    if (/uq_gs1_identity_public_path|duplicate key/i.test(message)) {
      throw new Gs1RegistryError("gs1_identity_owned_by_another_tenant", 409);
    }
    throw new Gs1RegistryError("gs1_registry_write_unavailable", 503);
  }
}
