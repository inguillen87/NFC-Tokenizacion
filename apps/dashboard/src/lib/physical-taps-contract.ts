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
