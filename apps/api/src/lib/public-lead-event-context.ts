const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,119}$/;
const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const UID_RE = /^[0-9A-F]{8,64}$/;
const EVENT_ID_RE = /^[1-9]\d{0,19}$/;

export type PublicLeadEventContextRow = {
  eventId: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  batchId: string | null;
  bid: string | null;
  tagId: string | null;
  uidHex: string | null;
  productName: string | null;
};

export type PublicLeadEventContext = {
  eventId: string;
  tenantId: string;
  tenantSlug: string;
  batchId: string;
  bid: string;
  tagId: string | null;
  uidHex: string | null;
  productName: string | null;
};

export class PublicLeadEventContextError extends Error {
  readonly code: string;
  readonly status: 404 | 409 | 422;

  constructor(code: string, status: 404 | 409 | 422) {
    super(code);
    this.name = "PublicLeadEventContextError";
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

/**
 * A public lead may carry a locator, never tenant or product authority. The
 * caller must prove an exact event+tenant+BID tuple and this resolver replaces
 * every browser identity field with the persisted event projection.
 */
export async function resolvePublicLeadEventContext(
  input: { eventId: unknown; tenantSlug: unknown; bid: unknown; uidHex?: unknown },
  lookup: (eventId: string) => Promise<PublicLeadEventContextRow[]>,
): Promise<PublicLeadEventContext> {
  const eventId = clean(input.eventId);
  const requestedTenant = lower(input.tenantSlug);
  const requestedBid = clean(input.bid);
  const requestedUid = upper(input.uidHex) || null;

  if (!EVENT_ID_RE.test(eventId)) {
    throw new PublicLeadEventContextError("lead_event_locator_invalid", 422);
  }
  if (!TENANT_SLUG_RE.test(requestedTenant) || !BID_RE.test(requestedBid)) {
    throw new PublicLeadEventContextError("lead_event_scope_required", 422);
  }
  if (requestedUid && !UID_RE.test(requestedUid)) {
    throw new PublicLeadEventContextError("lead_event_uid_invalid", 422);
  }

  const rows = await lookup(eventId);
  if (rows.length === 0) throw new PublicLeadEventContextError("lead_event_not_found", 404);
  if (rows.length !== 1) throw new PublicLeadEventContextError("lead_event_ambiguous", 409);

  const row = rows[0];
  const persistedEventId = clean(row.eventId);
  const tenantId = clean(row.tenantId);
  const tenantSlug = lower(row.tenantSlug);
  const batchId = clean(row.batchId);
  const bid = clean(row.bid);
  const tagId = clean(row.tagId) || null;
  const uidHex = upper(row.uidHex) || null;
  const productName = clean(row.productName) || null;

  if (!persistedEventId || !tenantId || !tenantSlug || !batchId || !bid) {
    throw new PublicLeadEventContextError("lead_event_context_incomplete", 404);
  }
  if (persistedEventId !== eventId || tenantSlug !== requestedTenant || bid !== requestedBid) {
    throw new PublicLeadEventContextError("lead_event_scope_mismatch", 422);
  }
  if (requestedUid && requestedUid !== uidHex) {
    throw new PublicLeadEventContextError("lead_event_uid_mismatch", 422);
  }

  return { eventId, tenantId, tenantSlug, batchId, bid, tagId, uidHex, productName };
}
