import { sql } from "./db";
import { ensureSunTenantProfilesSchema } from "./sun-tenant-profile-schema";
import {
  normalizeClaimPolicy,
  normalizeSunVertical,
  normalizeTokenizationMode,
  normalizeTenantSlug,
  SUN_CLAIM_POLICIES,
  SUN_TOKENIZATION_MODES,
  SUN_VERTICALS,
  type SunClaimPolicy,
  type SunTokenizationMode,
  type SunVertical,
} from "./sun-tenant-profile";

export type TenantSunProfileInput = {
  vertical: SunVertical;
  clubName: string;
  productLabel: string;
  originLabel: string;
  originAddress: string;
  originLat: number;
  originLng: number;
  tokenizationMode: SunTokenizationMode;
  claimPolicy: SunClaimPolicy;
  ownershipPolicy: Record<string, unknown>;
  manifestPolicy: Record<string, unknown>;
  theme?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function requiredNumber(value: unknown, field: string, missing: string[]) {
  const parsed = typeof value === "number" ? value : Number(String(value || "").trim());
  if (!Number.isFinite(parsed)) {
    missing.push(field);
    return null;
  }
  return parsed;
}

export function buildTenantSunProfileInput(body: Record<string, unknown>) {
  const sun = asRecord(body.sun_profile || body.sun || body.profile);
  const origin = asRecord(sun.origin || body.origin);
  const ownershipPolicy = asRecord(body.ownership_policy || sun.ownership_policy);
  const manifestPolicy = asRecord(body.manifest_policy || sun.manifest_policy);
  const missing: string[] = [];

  const vertical = normalizeSunVertical(firstString(body.vertical, sun.vertical, body.rubro, body.industry));
  const clubName = firstString(body.club_name, sun.club_name, sun.clubName);
  const productLabel = firstString(body.product_label, sun.product_label, sun.productLabel);
  const originLabel = firstString(body.origin_label, sun.origin_label, sun.originLabel, origin.label);
  const originAddress = firstString(body.origin_address, sun.origin_address, sun.originAddress, origin.address);
  const originLat = requiredNumber(body.origin_lat ?? sun.origin_lat ?? origin.lat, "origin_lat", missing);
  const originLng = requiredNumber(body.origin_lng ?? sun.origin_lng ?? origin.lng, "origin_lng", missing);
  const tokenizationMode = normalizeTokenizationMode(firstString(body.tokenization_mode, sun.tokenization_mode, sun.tokenizationMode));
  const claimPolicy = normalizeClaimPolicy(firstString(body.claim_policy, sun.claim_policy, sun.claimPolicy));

  if (!vertical) missing.push("vertical");
  if (!clubName) missing.push("club_name");
  if (!productLabel) missing.push("product_label");
  if (!originLabel) missing.push("origin_label");
  if (!originAddress) missing.push("origin_address");
  if (!tokenizationMode) missing.push("tokenization_mode");
  if (!claimPolicy) missing.push("claim_policy");
  if (!Object.keys(ownershipPolicy).length) missing.push("ownership_policy");
  if (!Object.keys(manifestPolicy).length) missing.push("manifest_policy");

  if (missing.length) {
    return {
      ok: false as const,
      missing,
      allowed: {
        verticals: SUN_VERTICALS,
        tokenizationModes: SUN_TOKENIZATION_MODES,
        claimPolicies: SUN_CLAIM_POLICIES,
      },
    };
  }

  return {
    ok: true as const,
    profile: {
      vertical: vertical!,
      clubName,
      productLabel,
      originLabel,
      originAddress,
      originLat: originLat!,
      originLng: originLng!,
      tokenizationMode: tokenizationMode!,
      claimPolicy: claimPolicy!,
      ownershipPolicy,
      manifestPolicy,
      theme: asRecord(body.theme || sun.theme),
      metadata: asRecord(body.metadata || sun.metadata),
    } satisfies TenantSunProfileInput,
  };
}

export async function upsertTenantSunProfile(tenantId: string, profile: TenantSunProfileInput) {
  await ensureSunTenantProfilesSchema();
  const rows = await sql/*sql*/`
    INSERT INTO tenant_sun_profiles (
      tenant_id,
      vertical,
      club_name,
      product_label,
      origin_label,
      origin_address,
      origin_lat,
      origin_lng,
      tokenization_mode,
      claim_policy,
      ownership_policy,
      manifest_policy,
      theme,
      metadata
    )
    VALUES (
      ${tenantId}::uuid,
      ${profile.vertical},
      ${profile.clubName},
      ${profile.productLabel},
      ${profile.originLabel},
      ${profile.originAddress},
      ${profile.originLat},
      ${profile.originLng},
      ${profile.tokenizationMode},
      ${profile.claimPolicy},
      ${JSON.stringify(profile.ownershipPolicy)}::jsonb,
      ${JSON.stringify(profile.manifestPolicy)}::jsonb,
      ${JSON.stringify(profile.theme || {})}::jsonb,
      ${JSON.stringify(profile.metadata || {})}::jsonb
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      vertical = EXCLUDED.vertical,
      club_name = EXCLUDED.club_name,
      product_label = EXCLUDED.product_label,
      origin_label = EXCLUDED.origin_label,
      origin_address = EXCLUDED.origin_address,
      origin_lat = EXCLUDED.origin_lat,
      origin_lng = EXCLUDED.origin_lng,
      tokenization_mode = EXCLUDED.tokenization_mode,
      claim_policy = EXCLUDED.claim_policy,
      ownership_policy = EXCLUDED.ownership_policy,
      manifest_policy = EXCLUDED.manifest_policy,
      theme = EXCLUDED.theme,
      metadata = EXCLUDED.metadata,
      updated_at = now()
    RETURNING *
  `;
  return rows[0] || null;
}

export async function getTenantSunProfileReadiness(tenantId: string) {
  await ensureSunTenantProfilesSchema();
  const rows = await sql/*sql*/`
    SELECT
      tenant_id::text,
      vertical,
      club_name,
      product_label,
      origin_label,
      origin_address,
      origin_lat,
      origin_lng,
      tokenization_mode,
      claim_policy,
      ownership_policy,
      manifest_policy
    FROM tenant_sun_profiles
    WHERE tenant_id = ${tenantId}::uuid
    LIMIT 1
  `;
  const profile = rows[0] || null;
  const missing: string[] = [];
  if (!profile) missing.push("tenant_sun_profiles");
  if (profile) {
    if (!normalizeSunVertical(profile.vertical)) missing.push("tenant_sun_profiles.vertical");
    if (!firstString(profile.club_name)) missing.push("tenant_sun_profiles.club_name");
    if (!firstString(profile.product_label)) missing.push("tenant_sun_profiles.product_label");
    if (!firstString(profile.origin_label)) missing.push("tenant_sun_profiles.origin_label");
    if (!firstString(profile.origin_address)) missing.push("tenant_sun_profiles.origin_address");
    if (!Number.isFinite(Number(profile.origin_lat))) missing.push("tenant_sun_profiles.origin_lat");
    if (!Number.isFinite(Number(profile.origin_lng))) missing.push("tenant_sun_profiles.origin_lng");
    if (!normalizeTokenizationMode(profile.tokenization_mode)) missing.push("tenant_sun_profiles.tokenization_mode");
    if (!normalizeClaimPolicy(profile.claim_policy)) missing.push("tenant_sun_profiles.claim_policy");
    if (!Object.keys(asRecord(profile.ownership_policy)).length) missing.push("tenant_sun_profiles.ownership_policy");
    if (!Object.keys(asRecord(profile.manifest_policy)).length) missing.push("tenant_sun_profiles.manifest_policy");
  }
  return { ok: missing.length === 0, missing, profile };
}

export async function requireTenantSunProfile(tenantId: string) {
  const readiness = await getTenantSunProfileReadiness(tenantId);
  if (readiness.ok) return readiness;
  const error = new Error("tenant_sun_profile_incomplete");
  (error as Error & { missing?: string[] }).missing = readiness.missing;
  throw error;
}

export function normalizeTenantCreateSlug(value: unknown) {
  return normalizeTenantSlug(value);
}

export function readSunConfigPath(source: unknown, path: string[]) {
  return readPath(source, path);
}
