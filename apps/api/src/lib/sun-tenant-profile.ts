export const SUN_VERTICALS = ["wine", "spirits", "events", "cosmetics", "agro", "pharma", "luxury", "art", "documents"] as const;
export type SunVertical = typeof SUN_VERTICALS[number];

export const SUN_TOKENIZATION_MODES = ["valid_only", "valid_and_opened", "manual"] as const;
export type SunTokenizationMode = typeof SUN_TOKENIZATION_MODES[number];

export const SUN_CLAIM_POLICIES = [
  "purchase_proof_required",
  "retailer_attested",
  "inside_pack_secret",
  "admin_approved",
] as const;
export type SunClaimPolicy = typeof SUN_CLAIM_POLICIES[number];

export type SunTenantProfilePassport = {
  tenant_id?: string | null;
  tenant_slug?: string | null;
  tenant_name?: string | null;
  batch_status?: string | null;
  batch_sdm_config?: Record<string, unknown> | null;
  sun_profile_vertical?: string | null;
  sun_profile_club_name?: string | null;
  sun_profile_product_label?: string | null;
  sun_profile_origin_label?: string | null;
  sun_profile_origin_address?: string | null;
  sun_profile_origin_lat?: number | string | null;
  sun_profile_origin_lng?: number | string | null;
  sun_profile_tokenization_mode?: string | null;
  sun_profile_claim_policy?: string | null;
  sun_profile_ownership_policy?: Record<string, unknown> | null;
  sun_profile_manifest_policy?: Record<string, unknown> | null;
  product_name?: string | null;
  sku?: string | null;
  winery?: string | null;
  region?: string | null;
  grape_varietal?: string | null;
  vintage?: string | null;
  harvest_year?: number | null;
  barrel_months?: number | null;
  temperature_storage?: string | null;
};

export type SunTenantProfile = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  vertical: SunVertical;
  productLabel: string;
  clubName: string;
  tokenizationMode: SunTokenizationMode;
  claimPolicy: SunClaimPolicy;
  ownershipPolicy: Record<string, unknown>;
  manifestPolicy: Record<string, unknown>;
  origin: {
    label: string;
    address: string;
    coordinates: { lat: number; lng: number };
    altitude: string | null;
  };
  product: {
    name: string;
    winery: string | null;
    region: string | null;
    varietal: string | null;
    vintage: string | null;
    harvestYear: number | null;
    barrelMonths: number | null;
    storage: string | null;
    alcohol: string | null;
    bottle: string | null;
    serving: string | null;
    oakType: string | null;
  };
};

export type SunTenantProfileResolution =
  | { ok: true; profile: SunTenantProfile }
  | {
      ok: false;
      setupRequired: true;
      code: "tenant_setup_required";
      message: string;
      bid: string;
      tenantId: string | null;
      tenantSlug: string | null;
      tenantName: string | null;
      missing: string[];
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readPath(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) return undefined;
    current = record[key];
  }
  return current;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeTenantSlug(value: unknown) {
  const raw = firstString(value);
  if (!raw) return null;
  const slug = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

export function normalizeSunVertical(value: unknown): SunVertical | null {
  const raw = firstString(value)?.toLowerCase().replace(/[\s-]+/g, "_") || "";
  if (!raw) return null;
  if (raw === "vino" || raw === "bodega" || raw === "winery") return "wine";
  if (raw === "destilados" || raw === "spirits" || raw === "whisky" || raw === "tequila" || raw === "gin") return "spirits";
  if (raw === "event" || raw === "eventos" || raw === "tickets" || raw === "ticket") return "events";
  if (raw === "cosmetica" || raw === "beauty" || raw === "perfume") return "cosmetics";
  if (raw === "seed" || raw === "crop" || raw === "campo") return "agro";
  if (raw === "medicamento" || raw === "laboratorio" || raw === "lab") return "pharma";
  if (raw === "lujo" || raw === "jewelry" || raw === "watch") return "luxury";
  if (raw === "arte" || raw === "art" || raw === "gallery" || raw === "certificate") return "art";
  if (raw === "docs" || raw === "documents" || raw === "documentos" || raw === "presence" || raw === "identity") return "documents";
  return (SUN_VERTICALS as readonly string[]).includes(raw) ? raw as SunVertical : null;
}

export function normalizeTokenizationMode(value: unknown): SunTokenizationMode | null {
  const raw = firstString(value)?.toLowerCase().replace(/[\s-]+/g, "_") || "";
  if (!raw) return null;
  if (raw === "valid" || raw === "closed_only") return "valid_only";
  if (raw === "opened" || raw === "lifecycle" || raw === "valid_or_opened") return "valid_and_opened";
  if (raw === "disabled" || raw === "off" || raw === "none") return "manual";
  return (SUN_TOKENIZATION_MODES as readonly string[]).includes(raw) ? raw as SunTokenizationMode : null;
}

export function normalizeClaimPolicy(value: unknown): SunClaimPolicy | null {
  const raw = firstString(value)?.toLowerCase().replace(/[\s-]+/g, "_") || "";
  if (!raw) return null;
  if (raw === "proof" || raw === "receipt" || raw === "purchase_receipt") return "purchase_proof_required";
  if (raw === "retailer" || raw === "seller_attested") return "retailer_attested";
  if (raw === "pack_secret" || raw === "inside_code") return "inside_pack_secret";
  if (raw === "manual_review") return "admin_approved";
  return (SUN_CLAIM_POLICIES as readonly string[]).includes(raw) ? raw as SunClaimPolicy : null;
}

function nonEmptyObject(value: unknown) {
  const record = asRecord(value);
  return record && Object.keys(record).length ? record : null;
}

export function resolveSunTenantProfile(input: {
  bid: string;
  passport?: SunTenantProfilePassport | null;
  result?: Record<string, unknown> | null;
}): SunTenantProfileResolution {
  const passport = input.passport || null;
  const result = input.result || null;
  const config = passport?.batch_sdm_config || null;
  const missing: string[] = [];

  const tenantId = firstString(passport?.tenant_id, result?.tenant_id);
  const tenantSlug = normalizeTenantSlug(firstString(passport?.tenant_slug, result?.tenant_slug));
  const tenantName = firstString(passport?.tenant_name, result?.tenant_name);
  const vertical = normalizeSunVertical(passport?.sun_profile_vertical);
  const clubName = firstString(passport?.sun_profile_club_name);
  const productLabel = firstString(passport?.sun_profile_product_label);
  const originLabel = firstString(passport?.sun_profile_origin_label);
  const originAddress = firstString(passport?.sun_profile_origin_address);
  const originLat = toNumber(passport?.sun_profile_origin_lat);
  const originLng = toNumber(passport?.sun_profile_origin_lng);
  const tokenizationMode = normalizeTokenizationMode(passport?.sun_profile_tokenization_mode);
  const claimPolicy = normalizeClaimPolicy(passport?.sun_profile_claim_policy);
  const ownershipPolicy = nonEmptyObject(passport?.sun_profile_ownership_policy);
  const manifestPolicy = nonEmptyObject(passport?.sun_profile_manifest_policy);
  const productName = firstString(passport?.product_name, passport?.sku, readPath(config, ["sun", "product", "name"]));

  if (!tenantId) missing.push("tenant_id");
  if (!tenantSlug) missing.push("tenant_slug");
  if (!tenantName) missing.push("tenant_name");
  if (!vertical) missing.push("tenant_sun_profiles.vertical");
  if (!clubName) missing.push("tenant_sun_profiles.club_name");
  if (!productLabel) missing.push("tenant_sun_profiles.product_label");
  if (!originLabel) missing.push("tenant_sun_profiles.origin_label");
  if (!originAddress) missing.push("tenant_sun_profiles.origin_address");
  if (originLat == null) missing.push("tenant_sun_profiles.origin_lat");
  if (originLng == null) missing.push("tenant_sun_profiles.origin_lng");
  if (!tokenizationMode) missing.push("tenant_sun_profiles.tokenization_mode");
  if (!claimPolicy) missing.push("tenant_sun_profiles.claim_policy");
  if (!ownershipPolicy) missing.push("tenant_sun_profiles.ownership_policy");
  if (!manifestPolicy) missing.push("tenant_sun_profiles.manifest_policy");
  if (!productName) missing.push("tag_profiles.product_name_or_sku");

  if (missing.length) {
    return {
      ok: false,
      setupRequired: true,
      code: "tenant_setup_required",
      message: "Tenant SUN profile, product identity, or manifest policy is incomplete. Complete onboarding before exposing consumer ownership/tokenization.",
      bid: input.bid,
      tenantId: tenantId || null,
      tenantSlug: tenantSlug || null,
      tenantName: tenantName || null,
      missing,
    };
  }

  return {
    ok: true,
    profile: {
      tenantId: tenantId!,
      tenantSlug: tenantSlug!,
      tenantName: tenantName!,
      vertical: vertical!,
      productLabel: productLabel!,
      clubName: clubName!,
      tokenizationMode: tokenizationMode!,
      claimPolicy: claimPolicy!,
      ownershipPolicy: ownershipPolicy!,
      manifestPolicy: manifestPolicy!,
      origin: {
        label: originLabel!,
        address: originAddress!,
        coordinates: { lat: originLat!, lng: originLng! },
        altitude: firstString(readPath(config, ["sun", "origin", "altitude"])),
      },
      product: {
        name: productName!,
        winery: firstString(passport?.winery, readPath(config, ["sun", "product", "producer"])),
        region: firstString(passport?.region, readPath(config, ["sun", "origin", "region"])),
        varietal: firstString(passport?.grape_varietal, readPath(config, ["sun", "product", "varietal"])),
        vintage: firstString(passport?.vintage, readPath(config, ["sun", "product", "vintage"])),
        harvestYear: typeof passport?.harvest_year === "number" ? passport.harvest_year : null,
        barrelMonths: typeof passport?.barrel_months === "number" ? passport.barrel_months : null,
        storage: firstString(passport?.temperature_storage, readPath(config, ["sun", "product", "storage"])),
        alcohol: firstString(readPath(config, ["sun", "product", "alcohol"])),
        bottle: firstString(readPath(config, ["sun", "product", "bottle"])),
        serving: firstString(readPath(config, ["sun", "product", "serving"])),
        oakType: firstString(readPath(config, ["sun", "product", "oakType"])),
      },
    },
  };
}
