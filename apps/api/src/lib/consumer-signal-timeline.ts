import { sql, type SqlExecutor } from "./db";

export const CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE = 50;

export const CONSUMER_SIGNAL_SOURCE_KINDS = [
  "consumer_tap",
  "incident",
  "loyalty_points",
  "order_request",
] as const;

export type ConsumerSignalSourceKind = typeof CONSUMER_SIGNAL_SOURCE_KINDS[number];

export type ConsumerSignalTimelineCursor = {
  v: 1;
  occurredAt: string;
  sourceKind: ConsumerSignalSourceKind;
  sourceId: string;
};

export type ConsumerSignalTimelineEntry = {
  sourceKind: ConsumerSignalSourceKind;
  sourceId: string;
  occurredAt: string;
  dataMode: string | null;
  provenance: {
    persistence: "durable";
    relation: string;
    dataModeField: string | null;
  };
  correlation: {
    consumerId: string;
    tapEventId: string | null;
    basis: Array<"consumer_id" | "tap_event_id">;
  };
  data: Record<string, string | number | null>;
};

export type ConsumerSignalSourceError = {
  sourceKind: ConsumerSignalSourceKind;
  code: "source_schema_unavailable" | "source_temporarily_unavailable" | "source_data_invalid" | "source_query_failed";
  retryable: boolean;
};

export type ConsumerSignalTimelineResult = {
  memberFound: boolean;
  tenantId: string | null;
  items: ConsumerSignalTimelineEntry[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  partial: boolean;
  sourceErrors: ConsumerSignalSourceError[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,512}$/;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SOURCE_KIND_SET = new Set<string>(CONSUMER_SIGNAL_SOURCE_KINDS);

class InvalidTimelineSourceRowError extends Error {
  constructor() {
    super("consumer_timeline_source_row_invalid");
  }
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim();
}

function requiredSourceId(value: unknown) {
  const sourceId = normalizedText(value);
  if (!SOURCE_ID_PATTERN.test(sourceId)) throw new InvalidTimelineSourceRowError();
  return sourceId;
}

function requiredIsoTimestamp(value: unknown) {
  const raw = value instanceof Date ? value.toISOString() : normalizedText(value);
  const timestamp = new Date(raw);
  if (!raw || Number.isNaN(timestamp.getTime())) throw new InvalidTimelineSourceRowError();
  return timestamp.toISOString();
}

function optionalText(value: unknown, maxLength = 4000) {
  if (value === null || value === undefined) return null;
  const result = normalizedText(value);
  return result ? result.slice(0, maxLength) : null;
}

function requiredInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number)) throw new InvalidTimelineSourceRowError();
  return number;
}

function explicitDataMode(value: unknown) {
  const mode = optionalText(value, 64)?.toLowerCase() || null;
  return mode && /^[a-z0-9][a-z0-9._-]{0,63}$/.test(mode) ? mode : null;
}

function tapEventId(value: unknown) {
  const normalized = normalizedText(value);
  return /^[1-9][0-9]{0,18}$/.test(normalized) ? normalized : null;
}

function correlation(consumerId: string, tapId: unknown) {
  const linkedTapEventId = tapEventId(tapId);
  return {
    consumerId,
    tapEventId: linkedTapEventId,
    basis: linkedTapEventId
      ? ["consumer_id", "tap_event_id"] as Array<"consumer_id" | "tap_event_id">
      : ["consumer_id"] as Array<"consumer_id" | "tap_event_id">,
  };
}

export function validConsumerTimelineTenantSlug(value: unknown) {
  return TENANT_SLUG_PATTERN.test(normalizedText(value).toLowerCase());
}

export function validConsumerTimelineConsumerId(value: unknown) {
  return UUID_PATTERN.test(normalizedText(value));
}

export function encodeConsumerTimelineCursor(cursor: ConsumerSignalTimelineCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeConsumerTimelineCursor(value: unknown): ConsumerSignalTimelineCursor | null {
  if (value === null || value === undefined || value === "") return null;
  const encoded = normalizedText(value);
  if (!CURSOR_PATTERN.test(encoded)) throw new Error("consumer_timeline_cursor_invalid");
  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
    const keys = Object.keys(decoded).sort();
    const occurredAt = normalizedText(decoded.occurredAt);
    const canonicalOccurredAt = new Date(occurredAt).toISOString();
    const sourceKind = normalizedText(decoded.sourceKind);
    const sourceId = normalizedText(decoded.sourceId);
    if (
      keys.join(",") !== "occurredAt,sourceId,sourceKind,v"
      || decoded.v !== 1
      || canonicalOccurredAt !== occurredAt
      || !SOURCE_KIND_SET.has(sourceKind)
      || !SOURCE_ID_PATTERN.test(sourceId)
    ) {
      throw new Error("consumer_timeline_cursor_invalid");
    }
    return {
      v: 1,
      occurredAt,
      sourceKind: sourceKind as ConsumerSignalSourceKind,
      sourceId,
    };
  } catch {
    throw new Error("consumer_timeline_cursor_invalid");
  }
}

function compareTimelineEntries(left: ConsumerSignalTimelineEntry, right: ConsumerSignalTimelineEntry) {
  if (left.occurredAt !== right.occurredAt) return left.occurredAt > right.occurredAt ? -1 : 1;
  if (left.sourceKind !== right.sourceKind) return left.sourceKind > right.sourceKind ? -1 : 1;
  if (left.sourceId !== right.sourceId) return left.sourceId > right.sourceId ? -1 : 1;
  return 0;
}

function sourceFailure(sourceKind: ConsumerSignalSourceKind, error: unknown): ConsumerSignalSourceError {
  if (error instanceof InvalidTimelineSourceRowError) {
    return { sourceKind, code: "source_data_invalid", retryable: false };
  }
  const code = normalizedText((error as { code?: unknown } | null)?.code);
  if (code === "42P01" || code === "42703" || code === "42883") {
    return { sourceKind, code: "source_schema_unavailable", retryable: false };
  }
  if (code.startsWith("08") || code === "57014" || code === "57P01" || code === "53300") {
    return { sourceKind, code: "source_temporarily_unavailable", retryable: true };
  }
  return { sourceKind, code: "source_query_failed", retryable: true };
}

function cursorParts(cursor: ConsumerSignalTimelineCursor | null) {
  return {
    occurredAt: cursor?.occurredAt || null,
    sourceKind: cursor?.sourceKind || "",
    sourceId: cursor?.sourceId || "",
  };
}

async function loadConsumerTaps(input: {
  tenantSlug: string;
  consumerId: string;
  cursor: ConsumerSignalTimelineCursor | null;
  executor: SqlExecutor;
}) {
  const cursor = cursorParts(input.cursor);
  const rows = await input.executor/*sql*/`
    SELECT
      history.id::text AS source_id,
      history.tap_event_id::text AS tap_event_id,
      history.verdict,
      history.risk_level,
      history.city,
      history.country,
      history.created_at::text AS occurred_at,
      event_truth.event_source AS data_mode,
      event_truth.event_matches
    FROM consumer_tap_history history
    JOIN tenants tenant ON tenant.id = history.tenant_id
    LEFT JOIN LATERAL (
      SELECT
        CASE WHEN count(*) = 1 THEN min(event.source::text) ELSE NULL END AS event_source,
        count(*)::integer AS event_matches
      FROM events event
      WHERE event.tenant_id = history.tenant_id
        AND event.id = history.tap_event_id
    ) event_truth ON true
    WHERE tenant.slug = ${input.tenantSlug}
      AND history.consumer_id = ${input.consumerId}::uuid
      AND (
        ${cursor.occurredAt}::timestamptz IS NULL
        OR (history.created_at, 'consumer_tap'::text, history.id::text)
          < (${cursor.occurredAt}::timestamptz, ${cursor.sourceKind}::text, ${cursor.sourceId}::text)
      )
    ORDER BY history.created_at DESC, history.id::text DESC
    LIMIT ${CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE + 1}
  `;
  return rows.map((row): ConsumerSignalTimelineEntry => ({
    sourceKind: "consumer_tap",
    sourceId: requiredSourceId(row.source_id),
    occurredAt: requiredIsoTimestamp(row.occurred_at),
    dataMode: Number(row.event_matches) === 1 ? explicitDataMode(row.data_mode) : null,
    provenance: {
      persistence: "durable",
      relation: "consumer_tap_history",
      dataModeField: Number(row.event_matches) === 1 ? "events.source" : null,
    },
    correlation: correlation(input.consumerId, row.tap_event_id),
    data: {
      verdict: optionalText(row.verdict, 80),
      riskLevel: optionalText(row.risk_level, 80),
      city: optionalText(row.city, 160),
      country: optionalText(row.country, 160),
      eventMatchCount: requiredInteger(row.event_matches),
    },
  }));
}

async function loadIncidents(input: {
  tenantSlug: string;
  consumerId: string;
  cursor: ConsumerSignalTimelineCursor | null;
  executor: SqlExecutor;
}) {
  const cursor = cursorParts(input.cursor);
  const rows = await input.executor/*sql*/`
    SELECT
      incident.id::text AS source_id,
      incident.event_id::text AS tap_event_id,
      incident.status,
      incident.severity,
      incident.title,
      incident.summary,
      incident.resolved_at::text AS resolved_at,
      incident.opened_at::text AS occurred_at,
      event.source::text AS data_mode
    FROM event_incidents incident
    JOIN tenants tenant ON tenant.id = incident.tenant_id
    JOIN consumer_tap_history history
      ON history.tenant_id = incident.tenant_id
     AND history.tap_event_id = incident.event_id
     AND history.consumer_id = ${input.consumerId}::uuid
    JOIN events event
      ON event.tenant_id = incident.tenant_id
     AND event.id = incident.event_id
     AND event.created_at = incident.event_created_at
    WHERE tenant.slug = ${input.tenantSlug}
      AND (
        ${cursor.occurredAt}::timestamptz IS NULL
        OR (incident.opened_at, 'incident'::text, incident.id::text)
          < (${cursor.occurredAt}::timestamptz, ${cursor.sourceKind}::text, ${cursor.sourceId}::text)
      )
    ORDER BY incident.opened_at DESC, incident.id::text DESC
    LIMIT ${CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE + 1}
  `;
  return rows.map((row): ConsumerSignalTimelineEntry => ({
    sourceKind: "incident",
    sourceId: requiredSourceId(row.source_id),
    occurredAt: requiredIsoTimestamp(row.occurred_at),
    dataMode: explicitDataMode(row.data_mode),
    provenance: {
      persistence: "durable",
      relation: "event_incidents",
      dataModeField: "events.source",
    },
    correlation: correlation(input.consumerId, row.tap_event_id),
    data: {
      status: optionalText(row.status, 80),
      severity: optionalText(row.severity, 80),
      title: optionalText(row.title, 160),
      summary: optionalText(row.summary, 4000),
      resolvedAt: row.resolved_at ? requiredIsoTimestamp(row.resolved_at) : null,
    },
  }));
}

async function loadLoyaltyPoints(input: {
  tenantSlug: string;
  consumerId: string;
  cursor: ConsumerSignalTimelineCursor | null;
  executor: SqlExecutor;
}) {
  const cursor = cursorParts(input.cursor);
  const rows = await input.executor/*sql*/`
    SELECT
      ledger.id::text AS source_id,
      ledger.tap_event_id::text AS tap_event_id,
      ledger.program_id::text AS program_id,
      ledger.source::text AS points_source,
      ledger.delta,
      ledger.balance_after,
      ledger.reason,
      ledger.created_at::text AS occurred_at,
      program.mode::text AS data_mode
    FROM points_ledger ledger
    JOIN loyalty_members member
      ON member.id = ledger.member_id
     AND member.tenant_id = ledger.tenant_id
     AND member.consumer_id = ${input.consumerId}::uuid
    JOIN loyalty_programs program
      ON program.id = ledger.program_id
     AND program.tenant_id = ledger.tenant_id
    JOIN tenants tenant ON tenant.id = ledger.tenant_id
    WHERE tenant.slug = ${input.tenantSlug}
      AND (
        ${cursor.occurredAt}::timestamptz IS NULL
        OR (ledger.created_at, 'loyalty_points'::text, ledger.id::text)
          < (${cursor.occurredAt}::timestamptz, ${cursor.sourceKind}::text, ${cursor.sourceId}::text)
      )
    ORDER BY ledger.created_at DESC, ledger.id::text DESC
    LIMIT ${CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE + 1}
  `;
  return rows.map((row): ConsumerSignalTimelineEntry => ({
    sourceKind: "loyalty_points",
    sourceId: requiredSourceId(row.source_id),
    occurredAt: requiredIsoTimestamp(row.occurred_at),
    dataMode: explicitDataMode(row.data_mode),
    provenance: {
      persistence: "durable",
      relation: "points_ledger",
      dataModeField: "loyalty_programs.mode",
    },
    correlation: correlation(input.consumerId, row.tap_event_id),
    data: {
      programId: requiredSourceId(row.program_id),
      source: optionalText(row.points_source, 80),
      delta: requiredInteger(row.delta),
      balanceAfter: requiredInteger(row.balance_after),
      reason: optionalText(row.reason, 500),
    },
  }));
}

async function loadOrderRequests(input: {
  tenantSlug: string;
  consumerId: string;
  cursor: ConsumerSignalTimelineCursor | null;
  executor: SqlExecutor;
}) {
  const cursor = cursorParts(input.cursor);
  const rows = await input.executor/*sql*/`
    SELECT
      request.id::text AS source_id,
      request.source_tap_event_id::text AS tap_event_id,
      request.marketplace_product_id::text AS marketplace_product_id,
      request.offer_id::text AS offer_id,
      request.status,
      request.quantity,
      request.created_at::text AS occurred_at,
      event.source::text AS data_mode
    FROM marketplace_order_requests request
    JOIN tenants tenant ON tenant.id = request.tenant_id
    LEFT JOIN events event
      ON event.tenant_id = request.tenant_id
     AND event.id = request.source_tap_event_id
     AND event.created_at = request.source_tap_event_created_at
    WHERE tenant.slug = ${input.tenantSlug}
      AND request.consumer_id = ${input.consumerId}::uuid
      AND (
        ${cursor.occurredAt}::timestamptz IS NULL
        OR (request.created_at, 'order_request'::text, request.id::text)
          < (${cursor.occurredAt}::timestamptz, ${cursor.sourceKind}::text, ${cursor.sourceId}::text)
      )
    ORDER BY request.created_at DESC, request.id::text DESC
    LIMIT ${CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE + 1}
  `;
  return rows.map((row): ConsumerSignalTimelineEntry => ({
    sourceKind: "order_request",
    sourceId: requiredSourceId(row.source_id),
    occurredAt: requiredIsoTimestamp(row.occurred_at),
    dataMode: explicitDataMode(row.data_mode),
    provenance: {
      persistence: "durable",
      relation: "marketplace_order_requests",
      dataModeField: row.tap_event_id ? "events.source" : null,
    },
    correlation: correlation(input.consumerId, row.tap_event_id),
    data: {
      marketplaceProductId: row.marketplace_product_id ? requiredSourceId(row.marketplace_product_id) : null,
      offerId: row.offer_id ? requiredSourceId(row.offer_id) : null,
      status: optionalText(row.status, 80),
      quantity: requiredInteger(row.quantity),
    },
  }));
}

export async function listConsumerSignalTimeline(input: {
  tenantSlug: string;
  consumerId: string;
  cursor?: ConsumerSignalTimelineCursor | null;
}, executor: SqlExecutor = sql): Promise<ConsumerSignalTimelineResult> {
  const tenantSlug = normalizedText(input.tenantSlug).toLowerCase();
  const consumerId = normalizedText(input.consumerId).toLowerCase();
  if (!validConsumerTimelineTenantSlug(tenantSlug)) throw new Error("consumer_timeline_tenant_invalid");
  if (!validConsumerTimelineConsumerId(consumerId)) throw new Error("consumer_timeline_consumer_invalid");

  const membershipRows = await executor/*sql*/`
    SELECT tenant.id::text AS tenant_id
    FROM tenant_consumer_memberships membership
    JOIN tenants tenant ON tenant.id = membership.tenant_id
    WHERE tenant.slug = ${tenantSlug}
      AND membership.consumer_id = ${consumerId}::uuid
    LIMIT 1
  `;
  const tenantId = optionalText(membershipRows[0]?.tenant_id, 36)?.toLowerCase() || null;
  if (!tenantId) {
    return {
      memberFound: false,
      tenantId: null,
      items: [],
      page: { limit: CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE, hasMore: false, nextCursor: null },
      partial: false,
      sourceErrors: [],
    };
  }
  if (!UUID_PATTERN.test(tenantId)) throw new Error("consumer_timeline_scope_invalid");

  const cursor = input.cursor || null;
  const sources = [
    { sourceKind: "consumer_tap" as const, load: loadConsumerTaps },
    { sourceKind: "incident" as const, load: loadIncidents },
    { sourceKind: "loyalty_points" as const, load: loadLoyaltyPoints },
    { sourceKind: "order_request" as const, load: loadOrderRequests },
  ];
  const settled = await Promise.allSettled(sources.map((source) => source.load({
    tenantSlug,
    consumerId,
    cursor,
    executor,
  })));

  const items: ConsumerSignalTimelineEntry[] = [];
  const sourceErrors: ConsumerSignalSourceError[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else sourceErrors.push(sourceFailure(sources[index].sourceKind, result.reason));
  });

  items.sort(compareTimelineEntries);
  const partial = sourceErrors.length > 0;
  // A cursor is only safe when every source participated in the merge. If one
  // source recovers after a partial page, advancing a global cursor could skip
  // its newer rows permanently. Force a fresh first-page reconciliation.
  const hasMore = !partial && items.length > CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE;
  const pageItems = items.slice(0, CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE);
  const lastItem = pageItems.at(-1) || null;
  return {
    memberFound: true,
    tenantId,
    items: pageItems,
    page: {
      limit: CONSUMER_SIGNAL_TIMELINE_PAGE_SIZE,
      hasMore,
      nextCursor: hasMore && lastItem ? encodeConsumerTimelineCursor({
        v: 1,
        occurredAt: lastItem.occurredAt,
        sourceKind: lastItem.sourceKind,
        sourceId: lastItem.sourceId,
      }) : null,
    },
    partial,
    sourceErrors,
  };
}
