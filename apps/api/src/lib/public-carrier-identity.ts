const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const UID_RE = /^[0-9A-F]{8,64}$/;

export const PUBLIC_PASSPORT_CARRIER_CODES = [
  "qr_basic",
  "gs1_digital_link",
  "ntag213",
  "ntag215",
  "ntag216",
] as const;

export type PublicPassportCarrierCode = (typeof PUBLIC_PASSPORT_CARRIER_CODES)[number];
export type PublicCarrierChannel = "qr" | "gs1_qr" | "static_nfc";
export type PublicCarrierProvenance = "declared" | "declared_static_nfc";

export type PublicCarrierRegistryBinding = {
  tenantId: string;
  tenantSlug: string;
  batchId: string;
  bid: string;
  tagId?: string | null;
};

export type PublicCarrierIdentityLookupInput = {
  bid: string;
  uidHex: string | null;
  tagId: string | null;
};

export type PublicCarrierIdentityRow = {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantStatus: string | null;
  batchId: string | null;
  bid: string | null;
  batchStatus: string | null;
  batchCarrierProfileCode: string | null;
  registeredCarrierProfileCode: string | null;
  tenantCarrierPolicyEnabled: boolean | null;
  batchConfig: Record<string, unknown> | null;
  tagId: string | null;
  tagUidHex: string | null;
  tagStatus: string | null;
  tagLifecycleState: string | null;
  tagCarrierProfileCode: string | null;
  tagProfileCarrierProfileCode: string | null;
  tagProfile: Record<string, unknown> | null;
};

export type PublicCarrierIdentityLookup = (
  input: PublicCarrierIdentityLookupInput,
) => Promise<PublicCarrierIdentityRow[]>;

export type PublicCarrierIdentity = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  batchId: string;
  bid: string;
  carrierProfileCode: PublicPassportCarrierCode;
  identityScope: "batch" | "unit";
  provisioningStatus: "batch_registered" | "unit_active";
  provenance: PublicCarrierProvenance;
  physicalPresenceVerified: false;
  uidHex: string | null;
  tagId: string | null;
  tagStatus: "active" | null;
  batchConfig: Record<string, unknown>;
  tagProfile: Record<string, unknown> | null;
};

export class PublicCarrierIdentityError extends Error {
  readonly code: string;
  readonly status: 404 | 409 | 422;

  constructor(code: string, status: 404 | 409 | 422) {
    super(code);
    this.name = "PublicCarrierIdentityError";
    this.code = code;
    this.status = status;
  }
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function lower(value: unknown) {
  return clean(value).toLowerCase();
}

function upper(value: unknown) {
  return clean(value).toUpperCase();
}

function isPublicCarrierCode(value: string): value is PublicPassportCarrierCode {
  return (PUBLIC_PASSPORT_CARRIER_CODES as readonly string[]).includes(value);
}

function sameId(left: unknown, right: unknown) {
  return lower(left) === lower(right);
}

/**
 * Resolve a public QR/static-NFC locator to persisted NexID identity. Browser
 * tenant, carrier and UID values are only locators: the lookup is intentionally
 * keyed by BID (plus an optional unit locator), then every scope is compared
 * with the server-owned row before it can reach the canonical event writer.
 */
export async function resolvePublicCarrierIdentity(
  input: {
    tenantSlug: unknown;
    bid: unknown;
    carrierProfileCode: unknown;
    channel: PublicCarrierChannel;
    uidHex?: unknown;
    registryBinding?: PublicCarrierRegistryBinding | null;
  },
  lookup: PublicCarrierIdentityLookup,
): Promise<PublicCarrierIdentity> {
  const requestedTenantSlug = lower(input.tenantSlug);
  const requestedBid = clean(input.bid);
  const requestedCarrier = lower(input.carrierProfileCode);
  const requestedUid = upper(input.uidHex) || null;

  if (!TENANT_SLUG_RE.test(requestedTenantSlug) || !BID_RE.test(requestedBid)) {
    throw new PublicCarrierIdentityError("public_carrier_locator_invalid", 422);
  }
  if (!isPublicCarrierCode(requestedCarrier)) {
    throw new PublicCarrierIdentityError("public_carrier_profile_invalid", 422);
  }
  if (requestedUid && !UID_RE.test(requestedUid)) {
    throw new PublicCarrierIdentityError("public_carrier_uid_invalid", 422);
  }
  if (input.channel === "static_nfc" && !requestedCarrier.startsWith("ntag2")) {
    throw new PublicCarrierIdentityError("public_carrier_channel_mismatch", 422);
  }
  if (input.channel === "qr" && requestedCarrier !== "qr_basic") {
    throw new PublicCarrierIdentityError("public_carrier_channel_mismatch", 422);
  }
  if (input.channel === "gs1_qr" && requestedCarrier !== "gs1_digital_link") {
    throw new PublicCarrierIdentityError("public_carrier_channel_mismatch", 422);
  }
  if (requestedCarrier === "gs1_digital_link" && !input.registryBinding) {
    throw new PublicCarrierIdentityError("public_carrier_registry_binding_required", 422);
  }

  const registryTagId = clean(input.registryBinding?.tagId) || null;
  const rows = await lookup({
    bid: requestedBid,
    uidHex: requestedUid,
    tagId: registryTagId,
  });
  if (rows.length === 0) {
    throw new PublicCarrierIdentityError("public_carrier_identity_not_found", 404);
  }
  if (rows.length !== 1) {
    throw new PublicCarrierIdentityError("public_carrier_identity_ambiguous", 409);
  }

  const row = rows[0];
  const tenantId = clean(row.tenantId);
  const tenantSlug = lower(row.tenantSlug);
  const tenantName = clean(row.tenantName) || tenantSlug;
  const batchId = clean(row.batchId);
  const bid = clean(row.bid);
  const batchCarrier = lower(row.batchCarrierProfileCode);
  const registeredCarrier = lower(row.registeredCarrierProfileCode);

  if (!tenantId || !tenantSlug || !batchId || !bid) {
    throw new PublicCarrierIdentityError("public_carrier_identity_incomplete", 404);
  }
  if (lower(row.tenantStatus) !== "active" || lower(row.batchStatus) !== "active") {
    throw new PublicCarrierIdentityError("public_carrier_scope_not_active", 404);
  }
  if (tenantSlug !== requestedTenantSlug) {
    throw new PublicCarrierIdentityError("public_carrier_tenant_binding_mismatch", 404);
  }
  if (bid !== requestedBid) {
    throw new PublicCarrierIdentityError("public_carrier_batch_binding_mismatch", 404);
  }
  if (!registeredCarrier || registeredCarrier !== batchCarrier) {
    throw new PublicCarrierIdentityError("public_carrier_profile_not_registered", 404);
  }
  if (batchCarrier !== requestedCarrier) {
    throw new PublicCarrierIdentityError("public_carrier_profile_binding_mismatch", 404);
  }
  if (row.tenantCarrierPolicyEnabled !== true) {
    throw new PublicCarrierIdentityError("public_carrier_tenant_policy_not_enabled", 404);
  }

  const registry = input.registryBinding;
  if (registry && (
    !sameId(registry.tenantId, tenantId)
    || lower(registry.tenantSlug) !== tenantSlug
    || !sameId(registry.batchId, batchId)
    || clean(registry.bid) !== bid
  )) {
    throw new PublicCarrierIdentityError("public_carrier_registry_scope_mismatch", 422);
  }

  const unitExpected = Boolean(requestedUid || registryTagId);
  const tagId = clean(row.tagId) || null;
  const tagUidHex = upper(row.tagUidHex) || null;
  if (unitExpected) {
    if (!tagId || !tagUidHex) {
      throw new PublicCarrierIdentityError("public_carrier_unit_not_registered", 404);
    }
    if (requestedUid && tagUidHex !== requestedUid) {
      throw new PublicCarrierIdentityError("public_carrier_unit_binding_mismatch", 404);
    }
    if (registryTagId && !sameId(tagId, registryTagId)) {
      throw new PublicCarrierIdentityError("public_carrier_registry_unit_mismatch", 422);
    }
    if (lower(row.tagStatus) !== "active" || (row.tagLifecycleState && lower(row.tagLifecycleState) !== "active")) {
      throw new PublicCarrierIdentityError("public_carrier_unit_not_active", 404);
    }
    const tagCarrier = lower(row.tagCarrierProfileCode);
    if (tagCarrier !== requestedCarrier) {
      throw new PublicCarrierIdentityError("public_carrier_unit_profile_mismatch", 404);
    }
    const tagProfileCarrier = lower(row.tagProfileCarrierProfileCode);
    if (!row.tagProfile || tagProfileCarrier !== requestedCarrier) {
      throw new PublicCarrierIdentityError("public_carrier_unit_profile_not_provisioned", 404);
    }
  }

  return {
    tenantId,
    tenantSlug,
    tenantName,
    batchId,
    bid,
    carrierProfileCode: requestedCarrier,
    identityScope: unitExpected ? "unit" : "batch",
    provisioningStatus: unitExpected ? "unit_active" : "batch_registered",
    provenance: input.channel === "static_nfc" ? "declared_static_nfc" : "declared",
    physicalPresenceVerified: false,
    uidHex: unitExpected ? tagUidHex : null,
    tagId: unitExpected ? tagId : null,
    tagStatus: unitExpected ? "active" : null,
    batchConfig: row.batchConfig && typeof row.batchConfig === "object" && !Array.isArray(row.batchConfig)
      ? row.batchConfig
      : {},
    tagProfile: unitExpected && row.tagProfile && typeof row.tagProfile === "object" && !Array.isArray(row.tagProfile)
      ? row.tagProfile
      : null,
  };
}
