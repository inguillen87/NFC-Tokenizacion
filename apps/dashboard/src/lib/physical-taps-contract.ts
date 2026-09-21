export type PhysicalTapState = "closed" | "opened" | "other";

export type PhysicalTapLocation = {
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  source: string;
  precision: "approximate" | "browser_approximate_consent" | "none";
  accuracyM: number | null;
  evidence: "persisted_event" | "none";
};

export type PhysicalTapRow = {
  eventId: string;
  tenantSlug: string;
  bid: string;
  productName: string;
  uidMasked: string;
  sealState: PhysicalTapState;
  reportedState: string;
  messageValid: boolean;
  result: string;
  verdict: string;
  source: "real";
  dataMode: "physical_real";
  occurredAt: {
    utc: string;
    local: string;
    timezone: string;
    label: string;
  };
  readCounter: number | null;
  location: PhysicalTapLocation;
  evidence: {
    kind: "physical_nfc_tt_evidenced" | "real_tap_event_carrier_unconfirmed";
    messageAuthentication: "validated" | "not_validated";
    ttStatusReported: boolean;
    ttState: string | null;
    ttRaw: string | null;
    ttBindingStatus: string;
    ttBindingReason: string | null;
    ttStatusSource: string | null;
    ttStatusOffset: number | null;
    ttStatusLength: number | null;
    ttEvidenceAuthority: "nexid_tt_durable_receipt" | "not_reported";
    physicalPackagingMeaning: "integration_dependent";
  };
};

export type PhysicalTapsPayload = {
  scope: {
    tenant: string;
    bid: string;
    source: "real";
    limit: number;
    range?: string;
  };
  summary: {
    total: number;
    closed: number;
    opened: number;
    other: number;
    distinctUnits: number;
    latestAt: string | null;
    comparisonAvailable: boolean;
    comparisonMeaning: "independent_physical_taps_not_a_product_journey";
  };
  rows: PhysicalTapRow[];
};

export type PhysicalTapsAvailability = "ready" | "requires_tenant_session" | "forbidden" | "upstream_error" | "invalid_payload" | "unreachable";

export type PhysicalTapsResult = {
  availability: PhysicalTapsAvailability;
  payload: PhysicalTapsPayload | null;
  detail: string;
  checkedAt: string;
};

const RECOVERABLE_PHYSICAL_TAPS_AVAILABILITIES: ReadonlySet<PhysicalTapsAvailability> = new Set([
  "upstream_error",
  "invalid_payload",
  "unreachable",
]);

export function isRecoverablePhysicalTapsAvailability(availability: PhysicalTapsAvailability) {
  return RECOVERABLE_PHYSICAL_TAPS_AVAILABILITIES.has(availability);
}

export function canRefreshPhysicalTaps(availability: PhysicalTapsAvailability) {
  return availability === "ready" || isRecoverablePhysicalTapsAvailability(availability);
}

export function mergePhysicalTapsRefresh(
  current: PhysicalTapsResult,
  incoming: PhysicalTapsResult,
): PhysicalTapsResult {
  if (incoming.availability === "ready") return incoming;
  if (
    current.availability === "ready"
    && current.payload
    && isRecoverablePhysicalTapsAvailability(incoming.availability)
  ) {
    return current;
  }
  return incoming;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nonNegativeInteger(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoOrEmpty(value: unknown) {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : "";
}

function normalizeLocation(value: unknown): PhysicalTapLocation | null {
  const input = record(value);
  if (!input) return null;
  const precision = text(input.precision);
  if (precision !== "approximate" && precision !== "browser_approximate_consent" && precision !== "none") return null;
  const lat = finiteNumber(input.lat);
  const lng = finiteNumber(input.lng);
  if ((lat === null) !== (lng === null)) return null;
  if (lat !== null && (lat < -90 || lat > 90 || lng === null || lng < -180 || lng > 180)) return null;
  const locationEvidence = text(input.evidence);
  if (precision === "none" && (lat !== null || locationEvidence !== "none")) return null;
  if (precision !== "none" && (lat === null || !text(input.source) || locationEvidence !== "persisted_event")) return null;
  const accuracyM = finiteNumber(input.accuracyM);
  return {
    city: text(input.city),
    region: text(input.region),
    country: text(input.country),
    lat,
    lng,
    source: text(input.source),
    precision,
    accuracyM: accuracyM !== null && accuracyM >= 0 ? accuracyM : null,
    evidence: locationEvidence === "persisted_event" ? "persisted_event" : "none",
  };
}

function normalizeRow(value: unknown): PhysicalTapRow | null {
  const input = record(value);
  const occurredAt = record(input?.occurredAt);
  const evidence = record(input?.evidence);
  const location = normalizeLocation(input?.location);
  if (!input || !occurredAt || !evidence || !location) return null;
  const state = text(input.sealState);
  if (state !== "closed" && state !== "opened" && state !== "other") return null;
  if (text(input.source) !== "real") return null;
  if (text(input.dataMode) !== "physical_real") return null;
  const evidenceKind = text(evidence.kind);
  if (evidenceKind !== "physical_nfc_tt_evidenced" && evidenceKind !== "real_tap_event_carrier_unconfirmed") return null;
  const authority = text(evidence.ttEvidenceAuthority);
  if (authority !== "nexid_tt_durable_receipt" && authority !== "not_reported") return null;
  if (evidenceKind === "physical_nfc_tt_evidenced" && (evidence.ttStatusReported !== true || authority !== "nexid_tt_durable_receipt")) return null;
  if (evidenceKind === "real_tap_event_carrier_unconfirmed" && authority !== "not_reported") return null;
  if (text(evidence.physicalPackagingMeaning) !== "integration_dependent") return null;
  const utc = isoOrEmpty(occurredAt.utc);
  const eventId = text(input.eventId);
  const uidMasked = text(input.uidMasked);
  if (!eventId || !uidMasked || !utc) return null;
  return {
    eventId,
    tenantSlug: text(input.tenantSlug),
    bid: text(input.bid),
    productName: text(input.productName),
    uidMasked,
    sealState: state,
    reportedState: text(input.reportedState),
    messageValid: input.messageValid === true,
    result: text(input.result),
    verdict: text(input.verdict),
    source: "real",
    dataMode: "physical_real",
    occurredAt: {
      utc,
      local: text(occurredAt.local),
      timezone: text(occurredAt.timezone),
      label: text(occurredAt.label),
    },
    readCounter: nonNegativeInteger(input.readCounter),
    location,
    evidence: {
      kind: evidenceKind,
      messageAuthentication: text(evidence.messageAuthentication) === "validated" ? "validated" : "not_validated",
      ttStatusReported: evidence.ttStatusReported === true,
      ttState: text(evidence.ttState) || null,
      ttRaw: text(evidence.ttRaw) || null,
      ttBindingStatus: text(evidence.ttBindingStatus),
      ttBindingReason: text(evidence.ttBindingReason) || null,
      ttStatusSource: text(evidence.ttStatusSource) || null,
      ttStatusOffset: finiteNumber(evidence.ttStatusOffset),
      ttStatusLength: finiteNumber(evidence.ttStatusLength),
      ttEvidenceAuthority: authority,
      physicalPackagingMeaning: "integration_dependent",
    },
  };
}

export function normalizePhysicalTapsPayload(value: unknown): PhysicalTapsPayload | null {
  const input = record(value);
  const scope = record(input?.scope);
  const summary = record(input?.summary);
  if (!input || !scope || !summary || !Array.isArray(input.rows)) return null;
  if (text(scope.source) !== "real") return null;
  const total = nonNegativeInteger(summary.total);
  const closed = nonNegativeInteger(summary.closed);
  const opened = nonNegativeInteger(summary.opened);
  const other = nonNegativeInteger(summary.other);
  const distinctUnits = nonNegativeInteger(summary.distinctUnits);
  const limit = nonNegativeInteger(scope.limit);
  if (total === null || closed === null || opened === null || other === null || distinctUnits === null || limit === null) return null;
  if (!text(scope.tenant) || !text(scope.bid) || limit < 1 || limit > 100) return null;
  if (closed + opened + other !== total) return null;
  if (input.rows.length !== total || distinctUnits > total) return null;
  if (typeof summary.comparisonAvailable !== "boolean" || text(summary.comparisonMeaning) !== "independent_physical_taps_not_a_product_journey") return null;
  if (text(input.availability) !== "available") return null;
  const rows = input.rows.map(normalizeRow);
  if (rows.some((row) => row === null)) return null;
  const normalizedRows = rows as PhysicalTapRow[];
  const scopeTenant = text(scope.tenant);
  const scopeBid = text(scope.bid);
  if (normalizedRows.some((row) => row.tenantSlug !== scopeTenant || (scopeBid !== "all" && row.bid !== scopeBid))) return null;
  if (new Set(normalizedRows.map((row) => row.eventId)).size !== normalizedRows.length) return null;
  const latestAt = summary.latestAt === null ? null : isoOrEmpty(summary.latestAt);
  if (summary.latestAt !== null && !latestAt) return null;
  return {
    scope: {
      tenant: scopeTenant,
      bid: scopeBid,
      source: "real",
      limit,
      ...(text(scope.range) ? { range: text(scope.range) } : {}),
    },
    summary: {
      total,
      closed,
      opened,
      other,
      distinctUnits,
      latestAt,
      comparisonAvailable: summary.comparisonAvailable,
      comparisonMeaning: "independent_physical_taps_not_a_product_journey",
    },
    rows: normalizedRows,
  };
}

export function latestPhysicalTapByState(rows: PhysicalTapRow[], state: "closed" | "opened") {
  let latest: PhysicalTapRow | null = null;
  for (const row of rows) {
    if (row.sealState !== state) continue;
    if (!latest || Date.parse(row.occurredAt.utc) > Date.parse(latest.occurredAt.utc)) latest = row;
  }
  return latest;
}

const REALTIME_PHYSICAL_EVENT_TYPES = new Set(["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT"]);
const REALTIME_CLOSED_RESULTS = new Set(["VALID_CLOSED"]);
const REALTIME_OPENED_RESULTS = new Set([
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);

function realtimeSealState(result: string): PhysicalTapState {
  if (REALTIME_CLOSED_RESULTS.has(result)) return "closed";
  if (REALTIME_OPENED_RESULTS.has(result)) return "opened";
  return "other";
}

/**
 * Convert the canonical SSE projection into a conservative physical-tap row.
 * The realtime projection proves a persisted event, but it does not currently
 * include the durable TT receipt. We therefore never fabricate receipt fields;
 * an existing row loaded from the physical-taps endpoint keeps its original
 * reading and receipt on dedupe. Location is a mutable server projection.
 * The production transport also carries imports; only eventSource=real belongs
 * in this reader. That origin alone does not certify the physical carrier.
 */
export function physicalTapFromRealtimeProjection(value: unknown, tenantSlug: string): PhysicalTapRow | null {
  const input = record(value);
  if (!input) return null;
  const expectedTenant = text(tenantSlug).toLowerCase();
  const eventTenant = text(input.tenantSlug || input.tenant_slug).toLowerCase();
  const eventType = text(input.eventType || input.event_type).toUpperCase();
  const source = text(input.source).toLowerCase();
  const eventSource = text(input.eventSource || input.event_source).toLowerCase();
  if (
    !expectedTenant
    || eventTenant !== expectedTenant
    || !REALTIME_PHYSICAL_EVENT_TYPES.has(eventType)
    || source !== "production"
    || eventSource !== "real"
  ) return null;

  const eventId = text(input.eventId || input.id);
  const bid = text(input.bid);
  const uidMasked = text(input.uidMasked || input.uid_masked);
  const occurredAtUtc = isoOrEmpty(input.occurredAtUtc || input.occurredAt || input.created_at);
  if (!eventId || !bid || !uidMasked || !occurredAtUtc) return null;

  const result = text(input.result).toUpperCase();
  const lat = finiteNumber(input.lat);
  const lng = finiteNumber(input.lng);
  const hasCoordinate = lat !== null
    && lng !== null
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180;
  const locationSource = text(input.locationSource || input.location_source).toLowerCase();
  const browserConsent = [
    "browser_geolocation_approximate_consent",
    "browser_gps_approximate_consent",
    "browser_gps_reported",
  ].includes(locationSource);
  const accuracyM = finiteNumber(input.locationAccuracyM || input.location_accuracy_m);
  const authenticationVerified = input.authenticationVerified === true || input.authentication_verified === true;

  return {
    eventId,
    tenantSlug: eventTenant,
    bid,
    productName: text(input.productName || input.product_name),
    uidMasked,
    sealState: realtimeSealState(result),
    reportedState: result,
    messageValid: authenticationVerified,
    result,
    verdict: text(input.verdict).toLowerCase(),
    source: "real",
    dataMode: "physical_real",
    occurredAt: {
      utc: occurredAtUtc,
      local: text(input.occurredAtLocal || input.occurred_at_local) || occurredAtUtc,
      timezone: text(input.timezone) || "UTC",
      label: text(input.timezoneLabel || input.timezone_label) || "UTC",
    },
    readCounter: null,
    location: {
      city: text(input.city),
      region: "",
      country: text(input.country || input.country_code),
      lat: hasCoordinate ? lat : null,
      lng: hasCoordinate ? lng : null,
      source: hasCoordinate ? locationSource || "unknown_approx" : "none",
      precision: hasCoordinate ? browserConsent ? "browser_approximate_consent" : "approximate" : "none",
      accuracyM: hasCoordinate && accuracyM !== null && accuracyM >= 0 ? accuracyM : null,
      evidence: hasCoordinate ? "persisted_event" : "none",
    },
    evidence: {
      kind: "real_tap_event_carrier_unconfirmed",
      messageAuthentication: authenticationVerified ? "validated" : "not_validated",
      ttStatusReported: false,
      ttState: null,
      ttRaw: null,
      ttBindingStatus: "NOT_AVAILABLE_IN_REALTIME_PROJECTION",
      ttBindingReason: "durable_tt_receipt_requires_reconciliation",
      ttStatusSource: null,
      ttStatusOffset: null,
      ttStatusLength: null,
      ttEvidenceAuthority: "not_reported",
      physicalPackagingMeaning: "integration_dependent",
    },
  };
}

// These are the ranges accepted by the physical TAP reader and API, not the
// wider window of the shared realtime transport.
const PHYSICAL_TAPS_RANGE_MS: Readonly<Record<string, number>> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

export function mergePhysicalTapRealtimeProjection(
  current: PhysicalTapsResult,
  incoming: PhysicalTapRow,
  checkedAt: string,
  nowMs: number = Date.now(),
): PhysicalTapsResult | null {
  const payload = current.payload;
  if (current.availability !== "ready" || !payload) return null;
  if (incoming.tenantSlug !== payload.scope.tenant) return null;
  if (payload.scope.bid !== "all" && incoming.bid !== payload.scope.bid) return null;
  const rangeMs = PHYSICAL_TAPS_RANGE_MS[text(payload.scope.range)];
  const confirmedAt = isoOrEmpty(checkedAt);
  if (!Number.isFinite(rangeMs) || !Number.isFinite(nowMs) || !confirmedAt || !isoOrEmpty(incoming.occurredAt.utc)) return null;

  const existing = payload.rows.find((row) => row.eventId === incoming.eventId);
  // Keep the original physical evidence while applying the latest received
  // location projection, including an explicit removal. There is no location
  // revision in this contract, so this does not claim out-of-order protection.
  const updated = existing ? { ...existing, location: incoming.location } : incoming;
  const nextRows = [updated, ...payload.rows.filter((row) => row.eventId !== incoming.eventId)]
    .filter((row) => {
      // The original reading time controls membership. A newer snapshot or
      // location update must not bring an old reading into the current window.
      const occurredAtMs = Date.parse(row.occurredAt.utc);
      return Number.isFinite(occurredAtMs) && occurredAtMs >= nowMs - rangeMs && occurredAtMs <= nowMs;
    })
    .sort((left, right) => Date.parse(right.occurredAt.utc) - Date.parse(left.occurredAt.utc))
    .slice(0, payload.scope.limit);
  const closed = nextRows.filter((row) => row.sealState === "closed").length;
  const opened = nextRows.filter((row) => row.sealState === "opened").length;
  const latestAt = nextRows[0]?.occurredAt.utc || null;
  return {
    availability: "ready",
    detail: current.detail,
    checkedAt: confirmedAt,
    payload: {
      ...payload,
      rows: nextRows,
      summary: {
        total: nextRows.length,
        closed,
        opened,
        other: Math.max(nextRows.length - closed - opened, 0),
        distinctUnits: new Set(nextRows.map((row) => row.uidMasked)).size,
        latestAt,
        comparisonAvailable: closed > 0 && opened > 0,
        comparisonMeaning: "independent_physical_taps_not_a_product_journey",
      },
    },
  };
}
