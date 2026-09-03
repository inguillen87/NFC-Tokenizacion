import type {
  CustomerSignalAvailability,
  CustomerSignalSource,
} from "./customer-signal-timeline";

export type CustomerMember = {
  id: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  pointsBalance: number | null;
};

export type CustomerMemberTimelineSourceKind =
  | "consumer_tap"
  | "incident"
  | "loyalty_points"
  | "order_request";

export type CustomerMemberTimelineEntry = {
  sourceKind: CustomerMemberTimelineSourceKind;
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

export type CustomerMemberTimelineAvailability =
  | CustomerSignalAvailability
  | "not_selected"
  | "member_not_found"
  | "tenant_required";

export type CustomerMemberTimelineState = {
  availability: CustomerMemberTimelineAvailability;
  items: CustomerMemberTimelineEntry[];
  partial: boolean;
  sourceErrors: Array<{ sourceKind: string; code: string; retryable: boolean }>;
  hasMore: boolean;
  nextCursor: string | null;
};

export type CustomerMemberTimelineScope = {
  tenant: string;
  consumerId: string;
};

export type CustomerMemberDirectoryState = {
  availability: CustomerSignalAvailability;
  source: CustomerSignalSource;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCustomerMembers(rows: Array<Record<string, unknown>>): CustomerMember[] {
  return rows.flatMap((row) => {
    const id = optionalText(row.id);
    if (!id) return [];
    return [{
      id,
      displayName: optionalText(row.display_name),
      email: optionalText(row.email),
      phone: optionalText(row.phone),
      status: optionalText(row.status),
      pointsBalance: optionalNumber(row.points_balance),
    }];
  });
}

const SOURCE_KINDS = new Set<CustomerMemberTimelineSourceKind>([
  "consumer_tap",
  "incident",
  "loyalty_points",
  "order_request",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,512}$/;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DATA_KEYS_BY_SOURCE = Object.freeze({
  consumer_tap: new Set(["verdict", "riskLevel", "city", "country", "eventMatchCount"]),
  incident: new Set(["status", "severity", "title", "summary", "resolvedAt"]),
  loyalty_points: new Set(["programId", "source", "delta", "balanceAfter", "reason"]),
  order_request: new Set(["marketplaceProductId", "offerId", "status", "quantity"]),
} satisfies Record<CustomerMemberTimelineSourceKind, ReadonlySet<string>>);

function normalizedScopeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function validCustomerMemberTimelineTenant(value: unknown) {
  return TENANT_SLUG_PATTERN.test(normalizedScopeText(value));
}

export function validCustomerMemberTimelineConsumerId(value: unknown) {
  return UUID_PATTERN.test(normalizedScopeText(value));
}

export function validCustomerMemberTimelineCursor(value: unknown) {
  return typeof value === "string" && CURSOR_PATTERN.test(value);
}

function normalizeEntry(value: unknown, expectedConsumerId: string): CustomerMemberTimelineEntry | null {
  const item = record(value);
  const provenance = record(item?.provenance);
  const correlation = record(item?.correlation);
  const data = record(item?.data);
  if (!item || !provenance || !correlation || !data) return null;
  const sourceKind = optionalText(item.sourceKind) as CustomerMemberTimelineSourceKind | null;
  const sourceId = optionalText(item.sourceId);
  const occurredAt = optionalText(item.occurredAt);
  const consumerId = optionalText(correlation.consumerId);
  const relation = optionalText(provenance.relation);
  if (
    !sourceKind
    || !SOURCE_KINDS.has(sourceKind)
    || !sourceId
    || !SOURCE_ID_PATTERN.test(sourceId)
    || !occurredAt
    || Number.isNaN(Date.parse(occurredAt))
    || provenance?.persistence !== "durable"
    || !relation
    || !consumerId
    || normalizedScopeText(consumerId) !== expectedConsumerId
  ) return null;

  const rawBasis = Array.isArray(correlation.basis) ? correlation.basis : [];
  const basis = rawBasis.filter((entry): entry is "consumer_id" | "tap_event_id" => entry === "consumer_id" || entry === "tap_event_id");
  if (basis.length !== rawBasis.length || !basis.includes("consumer_id")) return null;

  const allowedDataKeys = DATA_KEYS_BY_SOURCE[sourceKind];
  const normalizedData = Object.fromEntries(Object.entries(data).flatMap(([key, raw]) => (
    allowedDataKeys.has(key) && (typeof raw === "string" || typeof raw === "number" || raw === null) ? [[key, raw]] : []
  )));

  return {
    sourceKind,
    sourceId,
    occurredAt,
    dataMode: optionalText(item.dataMode),
    provenance: {
      persistence: "durable",
      relation,
      dataModeField: optionalText(provenance.dataModeField),
    },
    correlation: {
      consumerId,
      tapEventId: optionalText(correlation.tapEventId),
      basis,
    },
    data: normalizedData,
  };
}

export function parseCustomerMemberTimelinePayload(
  value: unknown,
  expectedScope: CustomerMemberTimelineScope,
): Omit<CustomerMemberTimelineState, "availability"> | null {
  const payload = record(value);
  const page = record(payload?.page);
  if (!payload || payload.ok !== true || !Array.isArray(payload.items) || !page || !Array.isArray(payload.sourceErrors)) return null;
  const expectedTenant = normalizedScopeText(expectedScope.tenant);
  const expectedConsumerId = normalizedScopeText(expectedScope.consumerId);
  const payloadTenant = normalizedScopeText(payload.tenant);
  const payloadConsumerId = normalizedScopeText(payload.consumerId);
  if (
    !validCustomerMemberTimelineTenant(expectedTenant)
    || !validCustomerMemberTimelineConsumerId(expectedConsumerId)
    || payloadTenant !== expectedTenant
    || payloadConsumerId !== expectedConsumerId
    || payload.order !== "desc"
    || typeof page.hasMore !== "boolean"
  ) return null;

  const nextCursor = page.nextCursor;
  if (
    (page.hasMore === true && !validCustomerMemberTimelineCursor(nextCursor))
    || (page.hasMore === false && nextCursor !== null)
  ) return null;

  const items = payload.items.map((item) => normalizeEntry(item, expectedConsumerId));
  if (items.some((entry) => !entry)) return null;
  const sourceErrors = payload.sourceErrors.flatMap((raw) => {
    const error = record(raw);
    const sourceKind = optionalText(error?.sourceKind);
    const code = optionalText(error?.code);
    if (!sourceKind || !SOURCE_KINDS.has(sourceKind as CustomerMemberTimelineSourceKind) || !code || typeof error?.retryable !== "boolean") return [];
    return [{ sourceKind, code, retryable: error.retryable }];
  });
  if (sourceErrors.length !== payload.sourceErrors.length) return null;
  return {
    items: items as CustomerMemberTimelineEntry[],
    partial: payload.partial === true,
    sourceErrors,
    hasMore: page.hasMore,
    nextCursor: nextCursor as string | null,
  };
}

export function appendCustomerMemberTimelinePage(
  current: CustomerMemberTimelineState,
  nextPage: Omit<CustomerMemberTimelineState, "availability">,
): CustomerMemberTimelineState {
  if (current.availability !== "ready") return current;

  const deduplicated = new Map<string, CustomerMemberTimelineEntry>();
  for (const item of [...current.items, ...nextPage.items]) {
    deduplicated.set(`${item.sourceKind}:${item.sourceId}`, item);
  }
  const items = [...deduplicated.values()].sort((left, right) => {
    if (left.occurredAt !== right.occurredAt) return left.occurredAt > right.occurredAt ? -1 : 1;
    if (left.sourceKind !== right.sourceKind) return left.sourceKind > right.sourceKind ? -1 : 1;
    return left.sourceId > right.sourceId ? -1 : left.sourceId < right.sourceId ? 1 : 0;
  });

  const sourceErrors = new Map<string, CustomerMemberTimelineState["sourceErrors"][number]>();
  for (const error of [...current.sourceErrors, ...nextPage.sourceErrors]) {
    sourceErrors.set(`${error.sourceKind}:${error.code}:${String(error.retryable)}`, error);
  }

  return {
    availability: "ready",
    items,
    partial: current.partial || nextPage.partial,
    sourceErrors: [...sourceErrors.values()],
    hasMore: nextPage.hasMore,
    nextCursor: nextPage.nextCursor,
  };
}
