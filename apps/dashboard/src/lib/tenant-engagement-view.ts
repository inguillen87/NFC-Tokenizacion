export const TENANT_ENGAGEMENT_DOMAINS = [
  "passport",
  "content",
  "warranty",
  "support",
  "ownership",
  "loyalty",
] as const;

export const TENANT_ENGAGEMENT_STAGES = ["VIEWED", "STARTED", "CONFIRMED"] as const;
export const TENANT_ENGAGEMENT_SOURCES = ["real", "demo", "imported", "unknown"] as const;

export type TenantEngagementDomain = (typeof TENANT_ENGAGEMENT_DOMAINS)[number];
export type TenantEngagementStage = (typeof TENANT_ENGAGEMENT_STAGES)[number];
export type TenantEngagementSource = (typeof TENANT_ENGAGEMENT_SOURCES)[number];
export type TenantEngagementRange = "24h" | "7d" | "30d";
export type TenantEngagementConfirmation = "source_confirmed" | "client_declaration" | "unverified_confirmation";

export type TenantEngagementActivity = {
  id: string;
  domain: TenantEngagementDomain;
  stage: TenantEngagementStage;
  occurredAt: string;
  source: TenantEngagementSource;
  sourceEventType: string;
  actorState: "contactable_consumer" | "linked_without_contact_consent" | "ambiguous_link" | "anonymous";
  contactable: boolean;
  consentChannels: Array<"email" | "phone" | "whatsapp">;
  unit: {
    bid: string | null;
    batchId: string | null;
    tagId: string | null;
    sourceTapEventId: string | null;
  };
  provenance: {
    sourceKind: string;
    recordType: string;
    recordId: string;
    evidence: string;
    auditId: string | null;
    idempotencyStatus: "recorded" | "registry_deduplicated" | "not_available";
  };
};

export type TenantEngagementView = {
  tenant: { slug: string; name: string };
  range: TenantEngagementRange;
  selectedDomain: TenantEngagementDomain | "all";
  selectedSource: TenantEngagementSource | "all";
  matched: number;
  returned: number;
  truncated: boolean;
  activities: TenantEngagementActivity[];
  counts: {
    byDomain: Record<TenantEngagementDomain, number>;
    byStage: Record<TenantEngagementStage, number>;
    bySource: Record<TenantEngagementSource, number>;
    confirmations: Record<TenantEngagementConfirmation, number>;
    contactable: number;
  };
  boundaries: {
    actor: string | null;
    source: string | null;
    confirmed: string | null;
  };
};

const DOMAIN_SET = new Set<string>(TENANT_ENGAGEMENT_DOMAINS);
const STAGE_SET = new Set<string>(TENANT_ENGAGEMENT_STAGES);
const SOURCE_SET = new Set<string>(TENANT_ENGAGEMENT_SOURCES);
const RANGE_SET = new Set<string>(["24h", "7d", "30d"]);
const ACTOR_STATE_SET = new Set<string>([
  "contactable_consumer",
  "linked_without_contact_consent",
  "ambiguous_link",
  "anonymous",
]);
const CHANNEL_SET = new Set<string>(["email", "phone", "whatsapp"]);
const IDEMPOTENCY_SET = new Set<string>(["recorded", "registry_deduplicated", "not_available"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, maximum = 180) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maximum);
}

function optionalText(value: unknown, maximum = 180) {
  const normalized = boundedText(value, maximum);
  return normalized || null;
}

function nonNegativeInteger(value: unknown) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function emptyCount<T extends readonly string[]>(keys: T) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T[number], number>;
}

// Exact provenance tuples emitted by /admin/engagement. Unknown or mismatched
// evidence never becomes a system outcome merely because its stage is CONFIRMED.
const CONFIRMED_SOURCE_CONTRACTS = [
  ["canonical_lifecycle_event", "events", "server_confirmed_warranty_registration"],
  ["support_ticket", "tickets", "durable_ticket_created"],
  ["ownership_registry", "consumer_product_ownerships", "durable_claimed_ownership_record"],
  ["loyalty_registry", "loyalty_members", "durable_loyalty_membership"],
] as const;

export function classifyEngagementConfirmation(
  activity: Pick<TenantEngagementActivity, "stage" | "provenance">,
): TenantEngagementConfirmation | null {
  if (activity.stage !== "CONFIRMED") return null;
  const { sourceKind, recordType, recordId, evidence } = activity.provenance;
  if (!recordId) return "unverified_confirmation";
  if (sourceKind === "public_experience_event"
    && recordType === "sdk_external_events"
    && evidence === "client_reported_action") return "client_declaration";
  return CONFIRMED_SOURCE_CONTRACTS.some(([kind, record, proof]) =>
    sourceKind === kind && recordType === record && evidence === proof)
    ? "source_confirmed"
    : "unverified_confirmation";
}

function normalizeActivity(value: unknown): TenantEngagementActivity | null {
  const item = record(value);
  if (!item) return null;
  const actor = record(item.actor);
  const unit = record(item.unit);
  const provenance = record(item.provenance);
  const idempotency = record(provenance?.idempotency);
  if (!actor || !unit || !provenance || !idempotency || unit.isActorIdentity !== false) return null;

  const id = boundedText(item.id, 240);
  const domain = boundedText(item.domain, 32).toLowerCase();
  const stage = boundedText(item.stage, 32).toUpperCase();
  const source = boundedText(item.dataMode, 32).toLowerCase();
  const occurredAt = boundedText(item.occurredAt, 80);
  const actorState = boundedText(actor.state, 64).toLowerCase();
  const idempotencyStatus = boundedText(idempotency.status, 64).toLowerCase();
  if (
    !id
    || !DOMAIN_SET.has(domain)
    || !STAGE_SET.has(stage)
    || !SOURCE_SET.has(source)
    || !occurredAt
    || !Number.isFinite(Date.parse(occurredAt))
    || !ACTOR_STATE_SET.has(actorState)
    || !IDEMPOTENCY_SET.has(idempotencyStatus)
  ) return null;

  const channels = Array.isArray(actor.consentChannels)
    ? [...new Set(actor.consentChannels
      .map((channel) => boundedText(channel, 32).toLowerCase())
      .filter((channel) => CHANNEL_SET.has(channel)))] as Array<"email" | "phone" | "whatsapp">
    : [];
  const contactable = actor.contactable === true
    && actorState === "contactable_consumer"
    && channels.length > 0;

  return {
    id,
    domain: domain as TenantEngagementDomain,
    stage: stage as TenantEngagementStage,
    occurredAt: new Date(occurredAt).toISOString(),
    source: source as TenantEngagementSource,
    sourceEventType: boundedText(item.sourceEventType, 120),
    actorState: actorState as TenantEngagementActivity["actorState"],
    contactable,
    consentChannels: contactable ? channels.sort() : [],
    unit: {
      bid: optionalText(unit.bid, 160),
      batchId: optionalText(unit.batchId, 80),
      tagId: optionalText(unit.tagId, 80),
      sourceTapEventId: optionalText(unit.sourceTapEventId, 80),
    },
    provenance: {
      sourceKind: boundedText(provenance.sourceKind, 80),
      recordType: boundedText(provenance.recordType, 80),
      recordId: boundedText(provenance.recordId, 160),
      evidence: boundedText(provenance.evidence, 120),
      auditId: optionalText(provenance.auditId, 80),
      idempotencyStatus: idempotencyStatus as TenantEngagementActivity["provenance"]["idempotencyStatus"],
    },
  };
}

export function parseTenantEngagementPayload(
  value: unknown,
  expectedTenant?: string | null,
): TenantEngagementView | null {
  const payload = record(value);
  const scope = record(payload?.scope);
  const tenant = record(scope?.tenant);
  const totals = record(payload?.totals);
  const boundaries = record(payload?.boundaries);
  if (!payload || payload.ok !== true || !scope || !tenant || !totals || !Array.isArray(payload.items)) return null;

  const tenantSlug = boundedText(tenant.slug, 80).toLowerCase();
  const expected = boundedText(expectedTenant, 80).toLowerCase();
  const range = boundedText(scope.range, 16).toLowerCase();
  const selectedDomain = boundedText(scope.domain, 32).toLowerCase() || "all";
  const selectedSource = boundedText(scope.source, 32).toLowerCase() || "all";
  const matched = nonNegativeInteger(totals.matched);
  const returned = nonNegativeInteger(totals.returned);
  if (
    !tenantSlug
    || (expected && tenantSlug !== expected)
    || !RANGE_SET.has(range)
    || (selectedDomain !== "all" && !DOMAIN_SET.has(selectedDomain))
    || (selectedSource !== "all" && !SOURCE_SET.has(selectedSource))
    || matched === null
    || returned === null
  ) return null;

  const activities = payload.items
    .map(normalizeActivity)
    .filter((activity): activity is TenantEngagementActivity => activity !== null);
  if (activities.length !== payload.items.length || returned !== activities.length || matched < returned) return null;

  const byDomain = emptyCount(TENANT_ENGAGEMENT_DOMAINS);
  const byStage = emptyCount(TENANT_ENGAGEMENT_STAGES);
  const bySource = emptyCount(TENANT_ENGAGEMENT_SOURCES);
  const confirmations = emptyCount(["source_confirmed", "client_declaration", "unverified_confirmation"] as const);
  let contactable = 0;
  for (const activity of activities) {
    byDomain[activity.domain] += 1;
    byStage[activity.stage] += 1;
    bySource[activity.source] += 1;
    const confirmation = classifyEngagementConfirmation(activity);
    if (confirmation) confirmations[confirmation] += 1;
    if (activity.contactable) contactable += 1;
  }

  return {
    tenant: { slug: tenantSlug, name: boundedText(tenant.name, 120) || tenantSlug },
    range: range as TenantEngagementRange,
    selectedDomain: selectedDomain as TenantEngagementDomain | "all",
    selectedSource: selectedSource as TenantEngagementSource | "all",
    matched,
    returned,
    truncated: totals.truncated === true,
    activities,
    counts: { byDomain, byStage, bySource, confirmations, contactable },
    boundaries: {
      actor: optionalText(boundaries?.actor, 420),
      source: optionalText(boundaries?.source, 420),
      confirmed: optionalText(boundaries?.confirmed, 420),
    },
  };
}

export function readableEngagementEvent(value: unknown) {
  const key = boundedText(value, 120).toUpperCase();
  const labels: Record<string, string> = {
    PRODUCT_VIEWED: "Pasaporte del producto abierto",
    TECHNICAL_SHEET_VIEWED: "Ficha técnica consultada",
    SAFETY_SHEET_VIEWED: "Información de seguridad consultada",
    PPE_CONTENT_VIEWED: "Protección recomendada consultada",
    STEWARDSHIP_CONFIRMED: "Lectura declarada por el usuario",
    CROPWISE_CTA_CLICKED: "Herramienta agronómica iniciada",
    ADVISOR_CONTACT_REQUESTED: "Contacto con asesor solicitado",
    LOYALTY_OFFER_VIEWED: "Beneficio consultado",
    LOYALTY_JOINED: "Adhesión a fidelización confirmada",
    TRAINING_STARTED: "Capacitación iniciada",
    TRAINING_COMPLETED: "Capacitación completada",
    LEAD_CREATED: "Solicitud comercial registrada",
    PROBLEM_REPORTED: "Problema reportado",
    WARRANTY_REVIEW_REQUESTED: "Revisión de garantía solicitada",
    WARRANTY_REGISTERED: "Garantía registrada",
    TICKET_CREATED: "Caso de soporte creado",
    OWNERSHIP_ACTIVATED: "Titularidad reclamada",
  };
  if (labels[key]) return labels[key];
  if (!key) return "Actividad registrada";
  return key
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
