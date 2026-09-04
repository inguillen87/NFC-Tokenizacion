import { sql } from "./db";

const UID_HEX_RE = /^[0-9A-F]{8,20}$/;

export type PublicCtaTokenizationPolicy =
  | "ownership_required"
  | "lot_anchor"
  | "issuer_batch_anchor"
  | "disabled";

export type PublicCtaEventIdentity = {
  id?: string | number | null;
  uid_hex?: string | null;
  bid?: string | null;
  batch_id?: string | null;
  tenant_id?: string | null;
  tenant_slug?: string | null;
  batch_sdm_config?: unknown;
  sun_profile_vertical?: string | null;
  sun_profile_tokenization_mode?: string | null;
  sun_profile_claim_policy?: string | null;
  sun_profile_ownership_policy?: unknown;
  sun_profile_metadata?: unknown;
};

export type PublicCtaWarrantyPolicy = "request_review" | "disabled";

type PublicCtaTargetInput = {
  bid?: unknown;
  uid?: unknown;
  uid_hex?: unknown;
  event_id?: unknown;
  eventId?: unknown;
};

type EventIdentityLoader = (eventId: string) => Promise<PublicCtaEventIdentity | null | undefined>;

function clean(value: unknown) {
  return String(value || "").trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readPath(source: unknown, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const normalized = clean(value);
    if (normalized) return normalized;
  }
  return "";
}

function normalizePolicy(value: unknown): PublicCtaTokenizationPolicy | null {
  const normalized = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (["lot_anchor", "batch_lot_anchor"].includes(normalized)) return "lot_anchor";
  if (["issuer_batch_anchor", "batch_anchor", "issuer_anchor"].includes(normalized)) return "issuer_batch_anchor";
  if (["disabled", "off", "none", "manual", "manual_review", "issuer_transfer"].includes(normalized)) return "disabled";
  if ([
    "ownership_required",
    "owner_required",
    "claimed_owner",
    "fresh_valid_tap",
    "verified_opened_tap",
    "valid_only",
    "valid_and_opened",
  ].includes(normalized)) return "ownership_required";
  return null;
}

function explicitTokenizationPolicyCandidates(
  batchConfig: Record<string, unknown>,
  ownershipPolicy: Record<string, unknown>,
  tenantMetadata: Record<string, unknown>,
) {
  return [
    { source: "batch.sdm_config.tokenization.policy", value: readPath(batchConfig, ["tokenization", "policy"]) },
    { source: "batch.sdm_config.sun.passport.tokenizationPolicy", value: readPath(batchConfig, ["sun", "passport", "tokenizationPolicy"]) },
    { source: "batch.sdm_config.sun.tokenizationPolicy", value: readPath(batchConfig, ["sun", "tokenizationPolicy"]) },
    { source: "batch.sdm_config.tokenization_policy", value: batchConfig.tokenization_policy },
    { source: "tenant.ownership_policy.tokenizationPolicy", value: ownershipPolicy.tokenizationPolicy },
    { source: "tenant.ownership_policy.tokenization_policy", value: ownershipPolicy.tokenization_policy },
    { source: "tenant.metadata.tokenization.policy", value: readPath(tenantMetadata, ["tokenization", "policy"]) },
    { source: "tenant.metadata.tokenizationPolicy", value: tenantMetadata.tokenizationPolicy },
    { source: "tenant.metadata.tokenization_policy", value: tenantMetadata.tokenization_policy },
  ];
}

function explicitBoolean(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  const normalized = clean(value).toLowerCase();
  if (["true", "1", "on", "enabled"].includes(normalized)) return true;
  if (["false", "0", "off", "disabled"].includes(normalized)) return false;
  return null;
}

/**
 * A SUN tap is a metered custody operation, so vertical inference is not an
 * authorization boundary. Both the policy and auto-mint opt-in must be
 * explicit in tenant/batch configuration.
 */
export function resolveExplicitSunAutoTokenizationAuthorization(identity: PublicCtaEventIdentity) {
  const batchConfig = asRecord(identity.batch_sdm_config);
  const ownershipPolicy = asRecord(identity.sun_profile_ownership_policy);
  const tenantMetadata = asRecord(identity.sun_profile_metadata);
  const configuredPolicyCandidate = explicitTokenizationPolicyCandidates(batchConfig, ownershipPolicy, tenantMetadata)
    .find((candidate) => candidate.value !== undefined && candidate.value !== null && clean(candidate.value) !== "");
  const policyCandidate = configuredPolicyCandidate
    ? { ...configuredPolicyCandidate, policy: normalizePolicy(configuredPolicyCandidate.value) }
    : null;
  const autoCandidates = [
    { source: "batch.sdm_config.tokenization.auto_tokenize_on_valid_tap", value: readPath(batchConfig, ["tokenization", "auto_tokenize_on_valid_tap"]) },
    { source: "batch.sdm_config.tokenization.autoTokenizeOnValidTap", value: readPath(batchConfig, ["tokenization", "autoTokenizeOnValidTap"]) },
    { source: "batch.sdm_config.sun.auto_tokenize_on_valid_tap", value: readPath(batchConfig, ["sun", "auto_tokenize_on_valid_tap"]) },
    { source: "tenant.ownership_policy.auto_tokenize_on_valid_tap", value: ownershipPolicy.auto_tokenize_on_valid_tap },
    { source: "tenant.ownership_policy.autoTokenizeOnValidTap", value: ownershipPolicy.autoTokenizeOnValidTap },
    { source: "tenant.metadata.tokenization.auto_tokenize_on_valid_tap", value: readPath(tenantMetadata, ["tokenization", "auto_tokenize_on_valid_tap"]) },
    { source: "tenant.metadata.tokenization.autoTokenizeOnValidTap", value: readPath(tenantMetadata, ["tokenization", "autoTokenizeOnValidTap"]) },
  ];
  const configuredAutoCandidate = autoCandidates
    .find((candidate) => candidate.value !== undefined && candidate.value !== null && clean(candidate.value) !== "");
  const autoCandidate = configuredAutoCandidate
    ? { ...configuredAutoCandidate, enabled: explicitBoolean(configuredAutoCandidate.value) }
    : null;

  return {
    enabled: autoCandidate?.enabled === true,
    autoSource: autoCandidate?.source || "unconfigured",
    policy: policyCandidate?.policy || null,
    policySource: policyCandidate?.source || "unconfigured",
    configuredRecipient: configuredRecipient(batchConfig, ownershipPolicy, tenantMetadata),
  };
}

export function resolvePublicCtaTokenizationConfig(identity: PublicCtaEventIdentity) {
  const batchConfig = asRecord(identity.batch_sdm_config);
  const ownershipPolicy = asRecord(identity.sun_profile_ownership_policy);
  const tenantMetadata = asRecord(identity.sun_profile_metadata);
  const explicitCandidates = explicitTokenizationPolicyCandidates(batchConfig, ownershipPolicy, tenantMetadata);

  for (const candidate of explicitCandidates) {
    const policy = normalizePolicy(candidate.value);
    if (policy) {
      return {
        policy,
        policySource: candidate.source,
        configuredRecipient: configuredRecipient(batchConfig, ownershipPolicy, tenantMetadata),
      };
    }
  }

  const vertical = clean(identity.sun_profile_vertical).toLowerCase().replace(/[\s-]+/g, "_");
  const tokenizationMode = clean(identity.sun_profile_tokenization_mode).toLowerCase().replace(/[\s-]+/g, "_");
  if (["manual", "off", "disabled", "none"].includes(tokenizationMode)) {
    return {
      policy: "disabled" as const,
      policySource: "tenant.tokenization_mode",
      configuredRecipient: configuredRecipient(batchConfig, ownershipPolicy, tenantMetadata),
    };
  }
  if (vertical === "agro" && tokenizationMode) {
    return {
      policy: "lot_anchor" as const,
      policySource: "tenant.vertical.agro",
      configuredRecipient: configuredRecipient(batchConfig, ownershipPolicy, tenantMetadata),
    };
  }
  if (["events", "event", "cosmetics", "pharma", "art", "documents"].includes(vertical)) {
    return {
      policy: "disabled" as const,
      policySource: "tenant.vertical",
      configuredRecipient: configuredRecipient(batchConfig, ownershipPolicy, tenantMetadata),
    };
  }

  return {
    policy: "ownership_required" as const,
    policySource: "safe_default",
    configuredRecipient: configuredRecipient(batchConfig, ownershipPolicy, tenantMetadata),
  };
}

export function resolvePublicCtaWarrantyConfig(identity: PublicCtaEventIdentity) {
  const batchConfig = asRecord(identity.batch_sdm_config);
  const ownershipPolicy = asRecord(identity.sun_profile_ownership_policy);
  const tenantMetadata = asRecord(identity.sun_profile_metadata);
  const candidates: Array<{ source: string; value: unknown }> = [
    { source: "batch.sdm_config.warranty.policy", value: readPath(batchConfig, ["warranty", "policy"]) },
    { source: "batch.sdm_config.sun.passport.warrantyPolicy", value: readPath(batchConfig, ["sun", "passport", "warrantyPolicy"]) },
    { source: "batch.sdm_config.sun.warrantyPolicy", value: readPath(batchConfig, ["sun", "warrantyPolicy"]) },
    { source: "tenant.ownership_policy.warrantyPolicy", value: ownershipPolicy.warrantyPolicy },
    { source: "tenant.metadata.warranty.policy", value: readPath(tenantMetadata, ["warranty", "policy"]) },
    { source: "tenant.metadata.warrantyPolicy", value: tenantMetadata.warrantyPolicy },
  ];
  for (const candidate of candidates) {
    const normalized = clean(candidate.value).toLowerCase().replace(/[\s-]+/g, "_");
    if (["disabled", "off", "none"].includes(normalized)) {
      return { policy: "disabled" as const, policySource: candidate.source };
    }
    if (["request_review", "manual_review", "purchase_review", "consumer_request", "enabled"].includes(normalized)) {
      return { policy: "request_review" as const, policySource: candidate.source };
    }
  }

  // An explicit tenant claim policy is sufficient to accept a warranty review
  // request, but never to confirm coverage automatically.
  if (clean(identity.sun_profile_claim_policy)) {
    return { policy: "request_review" as const, policySource: "tenant.claim_policy" };
  }
  return { policy: null, policySource: "unconfigured" };
}

function configuredRecipient(
  batchConfig: Record<string, unknown>,
  ownershipPolicy: Record<string, unknown>,
  tenantMetadata: Record<string, unknown>,
) {
  return firstText(
    readPath(batchConfig, ["tokenization", "recipientWallet"]),
    readPath(batchConfig, ["tokenization", "recipient_wallet"]),
    readPath(batchConfig, ["sun", "passport", "recipientWallet"]),
    readPath(batchConfig, ["sun", "tokenization", "recipientWallet"]),
    batchConfig.recipientWallet,
    batchConfig.recipient_wallet,
    batchConfig.issuerWallet,
    batchConfig.issuer_wallet,
    ownershipPolicy.recipientWallet,
    ownershipPolicy.recipient_wallet,
    ownershipPolicy.custodialWallet,
    ownershipPolicy.custodial_wallet,
    readPath(tenantMetadata, ["tokenization", "recipientWallet"]),
    readPath(tenantMetadata, ["tokenization", "recipient_wallet"]),
    tenantMetadata.recipientWallet,
    tenantMetadata.recipient_wallet,
    tenantMetadata.issuerWallet,
    tenantMetadata.issuer_wallet,
  ) || null;
}

export function eventShareUid(eventId: string | number) {
  return `EVENT-${String(eventId).trim()}`;
}

function normalizeEventId(value: unknown) {
  const normalized = clean(value);
  if (!/^[1-9]\d*$/.test(normalized)) return "";
  try {
    return BigInt(normalized) > 0n ? normalized : "";
  } catch {
    return "";
  }
}

async function loadEventIdentity(eventId: string) {
  const rows = await sql/*sql*/`
    SELECT
      e.id,
      e.uid_hex,
      e.batch_id,
      e.tenant_id,
      t.slug AS tenant_slug,
      b.bid,
      b.sdm_config AS batch_sdm_config,
      tsp.vertical AS sun_profile_vertical,
      tsp.tokenization_mode AS sun_profile_tokenization_mode,
      tsp.claim_policy AS sun_profile_claim_policy,
      tsp.ownership_policy AS sun_profile_ownership_policy,
      tsp.metadata AS sun_profile_metadata
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    JOIN tenants t ON t.id = e.tenant_id
    LEFT JOIN tenant_sun_profiles tsp ON tsp.tenant_id = e.tenant_id
    WHERE e.id = ${eventId}::bigint
    LIMIT 1
  `;
  return (rows[0] || null) as PublicCtaEventIdentity | null;
}

export async function resolvePublicCtaTarget(
  input: PublicCtaTargetInput,
  options: { loadEventIdentity?: EventIdentityLoader } = {},
) {
  const suppliedBid = clean(input.bid);
  const suppliedUidRaw = clean(input.uid || input.uid_hex);
  const suppliedUid = suppliedUidRaw.toUpperCase();
  const suppliedEventId = clean(input.event_id || input.eventId);

  if (suppliedEventId) {
    const eventId = normalizeEventId(suppliedEventId);
    if (!eventId) return { ok: false as const, reason: "invalid event_id", status: 400 as const };
    if (suppliedUidRaw && !UID_HEX_RE.test(suppliedUid)) {
      return { ok: false as const, reason: "invalid uid format", status: 400 as const };
    }

    const identity = await (options.loadEventIdentity || loadEventIdentity)(eventId);
    if (!identity) return { ok: false as const, reason: "event not found", status: 404 as const };

    const eventBid = clean(identity.bid);
    const eventUid = clean(identity.uid_hex).toUpperCase();
    if (!eventBid || !UID_HEX_RE.test(eventUid)) {
      return { ok: false as const, reason: "event identity unavailable", status: 409 as const };
    }
    if (suppliedBid && suppliedBid !== eventBid) {
      return { ok: false as const, reason: "event bid mismatch", status: 409 as const };
    }
    if (suppliedUid && suppliedUid !== eventUid) {
      return { ok: false as const, reason: "event uid mismatch", status: 409 as const };
    }

    const canonicalEventId = clean(identity.id) || eventId;
    const tokenizationConfig = resolvePublicCtaTokenizationConfig(identity);
    const warrantyConfig = resolvePublicCtaWarrantyConfig(identity);
    return {
      ok: true as const,
      bid: eventBid,
      uid: eventUid,
      eventId: canonicalEventId,
      batchId: clean(identity.batch_id) || null,
      tenantId: clean(identity.tenant_id) || null,
      tenantSlug: clean(identity.tenant_slug) || null,
      shareUid: eventShareUid(canonicalEventId),
      source: "event" as const,
      tokenizationPolicy: tokenizationConfig.policy,
      tokenizationPolicySource: tokenizationConfig.policySource,
      configuredRecipient: tokenizationConfig.configuredRecipient,
      warrantyPolicy: warrantyConfig.policy,
      warrantyPolicySource: warrantyConfig.policySource,
    };
  }

  if (!suppliedBid || !UID_HEX_RE.test(suppliedUid)) {
    return { ok: false as const, reason: "bid and uid or event_id required", status: 400 as const };
  }

  return {
    ok: true as const,
    bid: suppliedBid,
    uid: suppliedUid,
    eventId: null,
    batchId: null,
    tenantId: null,
    tenantSlug: null,
    shareUid: suppliedUid,
    source: "uid" as const,
    tokenizationPolicy: "ownership_required" as const,
    tokenizationPolicySource: "safe_default",
    configuredRecipient: null,
    warrantyPolicy: null,
    warrantyPolicySource: "unconfigured",
  };
}
