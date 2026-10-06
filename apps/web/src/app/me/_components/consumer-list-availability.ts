export type ConsumerListSource<T> =
  | { status: "ready"; data: T[] }
  | { status: "unavailable"; data: null };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function reportedText(value: unknown) {
  return typeof value === "string" && Boolean(value.trim());
}

/** Only the endpoint's explicit successful items envelope can establish an empty list. */
export function readConsumerListSource<T>(payload: unknown, validItem?: (item: Record<string, unknown>) => boolean): ConsumerListSource<T> {
  if (!record(payload) || payload.ok !== true || !Array.isArray(payload.items)
    || !payload.items.every((item) => record(item) && (!validItem || validItem(item)))) {
    return { status: "unavailable", data: null };
  }
  // Keep the existing endpoint fields and identities intact for downstream consumers.
  return { status: "ready", data: payload.items as T[] };
}

export function hasConsumerBrandIdentity(item: Record<string, unknown>) {
  return [item.slug, item.tenant_id, item.name].some(reportedText);
}

export function hasMarketplaceListingIdentity(item: Record<string, unknown>) {
  return reportedText(item.id);
}

export function hasConsumerProductIdentity(item: Record<string, unknown>) {
  return reportedText(item.id) && reportedText(item.tenant_slug);
}

export function hasConsumerTapIdentity(item: Record<string, unknown>) {
  const id = item.tap_event_id;
  const canonicalId = typeof id === "number" ? Number.isSafeInteger(id) && id > 0
    : typeof id === "string" && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9_223_372_036_854_775_807n;
  return canonicalId && reportedText(item.tenant_slug);
}
