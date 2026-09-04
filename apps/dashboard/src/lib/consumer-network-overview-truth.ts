export type ConsumerNetworkDataSource = "production" | "demo" | "unavailable";

export type ConsumerNetworkOverviewMetrics = {
  totalActivity: number;
  totalTaps: number;
  customerActions: number;
  activityWithKnownActor: number;
  activityWithoutActor: number;
  actorLinkedActivityRate: number;
  recognizedUnits: number;
  knownActors: number;
  verifiedIdentityActors: number;
  activeTenantMembers: number;
  consentPurpose: "marketing";
  consentedActorsByChannel: {
    email: number;
    whatsapp: number;
    phone: number;
  };
  savedProducts: number;
  riskBlockedClaims: number;
};

export type ConsumerNetworkTopProduct = {
  productName: string;
  bid: string;
  claims: number;
};

export type ConsumerNetworkOverviewPayload = {
  tenant: string | null;
  overview: ConsumerNetworkOverviewMetrics;
  identityBoundary: string;
  topProductsByClaims: ConsumerNetworkTopProduct[];
};

export type ConsumerNetworkMember = {
  label: string;
  tenantSlug: string;
  status: string;
  pointsBalance: number | null;
  lastActivityAt: string | null;
};

export type ConsumerNetworkProduct = {
  productName: string;
  tenantSlug: string;
  bid: string;
  claimedCount: number;
  savedCount: number;
  latestActivityAt: string | null;
};

export type ConsumerNetworkTap = {
  eventId: string;
  tenantSlug: string;
  verdict: string | null;
  riskLevel: string | null;
  createdAt: string;
};

export type ParsedConsumerNetworkPayload<T> = {
  data: T;
  empty: boolean;
  latestRecordedAt: string | null;
};

type JsonRecord = Record<string, unknown>;
type NullableValue<T> = { valid: true; value: T | null } | { valid: false; value: null };

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const EXPLICIT_TIMEZONE_PATTERN = /(?:z|[+-]\d{2}:\d{2})$/i;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function owns(record: JsonRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function requiredText(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function looksLikeTechnicalIdentifier(value: string) {
  if (value.includes("@")) return false;
  const compact = value.replace(/^uid[\s:_-]*/i, "").replace(/[\s:-]/g, "");
  return /^[0-9a-f]{8,40}$/i.test(compact);
}

function nullableText(record: JsonRecord, key: string, maxLength = 240): NullableValue<string> {
  if (!owns(record, key)) return { valid: false, value: null };
  const value = record[key];
  if (value == null || value === "") return { valid: true, value: null };
  const normalized = requiredText(value, maxLength);
  return normalized ? { valid: true, value: normalized } : { valid: false, value: null };
}

function nonNegativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function nonNegativeInteger(value: unknown) {
  const parsed = nonNegativeNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function nullableNumber(record: JsonRecord, key: string): NullableValue<number> {
  if (!owns(record, key)) return { valid: false, value: null };
  if (record[key] == null) return { valid: true, value: null };
  const parsed = nonNegativeNumber(record[key]);
  return parsed === null ? { valid: false, value: null } : { valid: true, value: parsed };
}

function nullableTimestamp(record: JsonRecord, key: string): NullableValue<string> {
  if (!owns(record, key)) return { valid: false, value: null };
  if (record[key] == null) return { valid: true, value: null };
  if (typeof record[key] !== "string" || !EXPLICIT_TIMEZONE_PATTERN.test(record[key])) {
    return { valid: false, value: null };
  }
  const timestamp = new Date(record[key]);
  return Number.isNaN(timestamp.getTime())
    ? { valid: false, value: null }
    : { valid: true, value: timestamp.toISOString() };
}

function normalizedTenant(value: unknown) {
  const tenant = requiredText(value, 128)?.toLowerCase() || null;
  return tenant && TENANT_SLUG_PATTERN.test(tenant) ? tenant : null;
}

function parseEnvelope(payload: unknown, expectedTenant: string) {
  if (!isRecord(payload) || payload.ok !== true || !owns(payload, "tenant")) return null;

  const tenant = payload.tenant === null ? null : normalizedTenant(payload.tenant);
  if (payload.tenant !== null && !tenant) return null;

  const expected = expectedTenant.trim().toLowerCase();
  if (expected ? tenant !== expected : tenant !== null) return null;
  return { payload, tenant };
}

function rowTenant(record: JsonRecord, expectedTenant: string) {
  const tenant = normalizedTenant(record.tenant_slug);
  if (!tenant) return null;
  const expected = expectedTenant.trim().toLowerCase();
  return expected && tenant !== expected ? null : tenant;
}

function latestTimestamp(values: Array<string | null>) {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (time > latestTime) {
      latest = value;
      latestTime = time;
    }
  }
  return latest;
}

export function parseConsumerNetworkOverview(
  payload: unknown,
  expectedTenant: string,
): ParsedConsumerNetworkPayload<ConsumerNetworkOverviewPayload> | null {
  const envelope = parseEnvelope(payload, expectedTenant);
  if (!envelope || !isRecord(envelope.payload.overview)) return null;

  const raw = envelope.payload.overview;
  const counts = {
    totalActivity: nonNegativeInteger(raw.totalActivity),
    totalTaps: nonNegativeInteger(raw.totalTaps),
    customerActions: nonNegativeInteger(raw.customerActions),
    activityWithKnownActor: nonNegativeInteger(raw.activityWithKnownActor),
    activityWithoutActor: nonNegativeInteger(raw.activityWithoutActor),
    recognizedUnits: nonNegativeInteger(raw.recognizedUnits),
    knownActors: nonNegativeInteger(raw.knownActors),
    verifiedIdentityActors: nonNegativeInteger(raw.verifiedIdentityActors),
    activeTenantMembers: nonNegativeInteger(raw.activeTenantMembers),
    savedProducts: nonNegativeInteger(raw.savedProducts),
    riskBlockedClaims: nonNegativeInteger(raw.riskBlockedClaims),
  };
  if (Object.values(counts).some((value) => value === null)) return null;
  const safeCounts = counts as { [Key in keyof typeof counts]: number };

  const actorLinkedActivityRate = nonNegativeNumber(raw.actorLinkedActivityRate);
  const consents = isRecord(raw.consentedActorsByChannel) ? raw.consentedActorsByChannel : null;
  const email = consents ? nonNegativeInteger(consents.email) : null;
  const whatsapp = consents ? nonNegativeInteger(consents.whatsapp) : null;
  const phone = consents ? nonNegativeInteger(consents.phone) : null;
  if (
    actorLinkedActivityRate === null
    || actorLinkedActivityRate > 100
    || raw.consentPurpose !== "marketing"
    || email === null
    || whatsapp === null
    || phone === null
  ) return null;

  if (
    safeCounts.totalActivity !== safeCounts.totalTaps + safeCounts.customerActions
    || safeCounts.activityWithKnownActor + safeCounts.activityWithoutActor !== safeCounts.totalActivity
    || safeCounts.activityWithKnownActor > safeCounts.totalActivity
    || safeCounts.verifiedIdentityActors > safeCounts.activeTenantMembers
    || email > safeCounts.activeTenantMembers
    || whatsapp > safeCounts.activeTenantMembers
    || phone > safeCounts.activeTenantMembers
  ) return null;

  const expectedRate = safeCounts.totalActivity > 0
    ? Number(((safeCounts.activityWithKnownActor / safeCounts.totalActivity) * 100).toFixed(1))
    : 0;
  if (actorLinkedActivityRate !== expectedRate) return null;

  const identityBoundary = requiredText(envelope.payload.identityBoundary, 600);
  if (!identityBoundary || !Array.isArray(envelope.payload.topProductsByClaims)) return null;

  const topProductsByClaims: ConsumerNetworkTopProduct[] = [];
  for (const item of envelope.payload.topProductsByClaims) {
    if (!isRecord(item)) return null;
    const productName = requiredText(item.product_name, 240);
    const bid = requiredText(item.bid, 160);
    const claims = nonNegativeInteger(item.claims);
    if (!productName || !bid || claims === null) return null;
    topProductsByClaims.push({ productName, bid, claims });
  }

  const overview: ConsumerNetworkOverviewMetrics = {
    ...safeCounts,
    actorLinkedActivityRate,
    consentPurpose: "marketing",
    consentedActorsByChannel: { email, whatsapp, phone },
  };
  const empty = Object.values(safeCounts).every((value) => value === 0)
    && email === 0
    && whatsapp === 0
    && phone === 0
    && topProductsByClaims.length === 0;

  return {
    data: {
      tenant: envelope.tenant,
      overview,
      identityBoundary,
      topProductsByClaims,
    },
    empty,
    latestRecordedAt: null,
  };
}

export function parseConsumerNetworkMembers(
  payload: unknown,
  expectedTenant: string,
): ParsedConsumerNetworkPayload<ConsumerNetworkMember[]> | null {
  const envelope = parseEnvelope(payload, expectedTenant);
  if (!envelope || !Array.isArray(envelope.payload.items)) return null;

  const items: ConsumerNetworkMember[] = [];
  for (const item of envelope.payload.items) {
    if (!isRecord(item)) return null;
    const tenantSlug = rowTenant(item, expectedTenant);
    const displayName = nullableText(item, "display_name", 160);
    const maskedEmail = nullableText(item, "email_masked", 240);
    const status = requiredText(item.status, 80);
    const pointsBalance = nullableNumber(item, "points_balance");
    const lastActivityAt = nullableTimestamp(item, "last_activity_at");
    if (!tenantSlug || !displayName.valid || !maskedEmail.valid || !status || !pointsBalance.valid || !lastActivityAt.valid) return null;

    const displayLabel = displayName.value && !looksLikeTechnicalIdentifier(displayName.value)
      ? displayName.value
      : null;
    items.push({
      label: displayLabel || maskedEmail.value || "Actor conocido sin alias",
      tenantSlug,
      status,
      pointsBalance: pointsBalance.value,
      lastActivityAt: lastActivityAt.value,
    });
  }

  return {
    data: items,
    empty: items.length === 0,
    latestRecordedAt: latestTimestamp(items.map((item) => item.lastActivityAt)),
  };
}

export function parseConsumerNetworkProducts(
  payload: unknown,
  expectedTenant: string,
): ParsedConsumerNetworkPayload<ConsumerNetworkProduct[]> | null {
  const envelope = parseEnvelope(payload, expectedTenant);
  if (!envelope || !Array.isArray(envelope.payload.items)) return null;

  const items: ConsumerNetworkProduct[] = [];
  for (const item of envelope.payload.items) {
    if (!isRecord(item)) return null;
    const productName = requiredText(item.product_name, 240);
    const tenantSlug = rowTenant(item, expectedTenant);
    const bid = requiredText(item.bid, 160);
    const claimedCount = nonNegativeInteger(item.claimed_count);
    const savedCount = nonNegativeInteger(item.saved_count);
    const latestActivityAt = nullableTimestamp(item, "latest_activity_at");
    if (!productName || !tenantSlug || !bid || claimedCount === null || savedCount === null || !latestActivityAt.valid) return null;

    items.push({
      productName,
      tenantSlug,
      bid,
      claimedCount,
      savedCount,
      latestActivityAt: latestActivityAt.value,
    });
  }

  return {
    data: items,
    empty: items.length === 0,
    latestRecordedAt: latestTimestamp(items.map((item) => item.latestActivityAt)),
  };
}

export function parseConsumerNetworkTaps(
  payload: unknown,
  expectedTenant: string,
): ParsedConsumerNetworkPayload<ConsumerNetworkTap[]> | null {
  const envelope = parseEnvelope(payload, expectedTenant);
  if (!envelope || !Array.isArray(envelope.payload.items)) return null;

  const items: ConsumerNetworkTap[] = [];
  for (const item of envelope.payload.items) {
    if (!isRecord(item)) return null;
    const eventId = requiredText(item.tap_event_id, 160);
    const tenantSlug = rowTenant(item, expectedTenant);
    const verdict = nullableText(item, "verdict", 80);
    const riskLevel = nullableText(item, "risk_level", 80);
    const createdAt = nullableTimestamp(item, "created_at");
    if (!eventId || !tenantSlug || !verdict.valid || !riskLevel.valid || !createdAt.valid || !createdAt.value) return null;

    items.push({
      eventId,
      tenantSlug,
      verdict: verdict.value,
      riskLevel: riskLevel.value,
      createdAt: createdAt.value,
    });
  }

  return {
    data: items,
    empty: items.length === 0,
    latestRecordedAt: latestTimestamp(items.map((item) => item.createdAt)),
  };
}

export function buildUtcHourlyHeatmap(taps: ConsumerNetworkTap[]) {
  const counts = Array.from({ length: 24 }, () => 0);
  for (const tap of taps) counts[new Date(tap.createdAt).getUTCHours()] += 1;
  const max = Math.max(1, ...counts);
  return counts.map((count, hour) => ({ hour, count, intensity: count / max }));
}

export function describeProductActivity(product: ConsumerNetworkProduct) {
  if (product.claimedCount > 0) return "Claims registrados";
  if (product.savedCount > 0) return "Guardado sin claim";
  return "Sin actividad registrada";
}

export function formatUtcTimestamp(value: string | null) {
  if (!value) return "No informado por la fuente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No informado por la fuente";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

export function withTenantScope(path: string, tenantSlug: string) {
  const url = new URL(path, "https://dashboard.nexid.invalid");
  const tenant = tenantSlug.trim().toLowerCase();
  if (tenant) url.searchParams.set("tenant", tenant);
  else url.searchParams.delete("tenant");
  return `${url.pathname}${url.search}${url.hash}`;
}
