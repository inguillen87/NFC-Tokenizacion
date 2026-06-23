export type TenantTapRealtimeEvent = {
  eventId: string;
  tenantId: string | null;
  tenantSlug: string | null;
  batchId: string | null;
  tagId: string | null;
  uidMasked: string;
  occurredAt: string;
  occurredAtUtc: string;
  occurredAtLocal: string;
  timezone: string;
  timezoneLabel: string;
  timezoneOffset: string | null;
  verdict: string;
  riskLevel: string;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  locationSource?: string | null;
  locationAccuracyM?: number | null;
  deviceLabel?: string | null;
  deviceOs?: string | null;
  deviceType?: string | null;
  productName?: string | null;
  source: "production" | "demo";
};

function eventMs(row: TenantTapRealtimeEvent) {
  const candidates = [row.occurredAt, row.occurredAtUtc, row.occurredAtLocal];
  for (const value of candidates) {
    const ms = Date.parse(String(value || ""));
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function sortRealtimeEvents(rows: TenantTapRealtimeEvent[], max = 40) {
  const byId = new Map<string, TenantTapRealtimeEvent>();
  rows.forEach((row, index) => {
    const key = String(row.eventId || `${row.uidMasked || "uid"}-${row.occurredAt || "time"}-${index}`);
    const current = byId.get(key);
    if (!current || eventMs(row) >= eventMs(current)) byId.set(key, row);
  });
  return [...byId.values()]
    .sort((a, b) => eventMs(b) - eventMs(a))
    .slice(0, max);
}

export function mergeRealtimeEvents(
  previous: TenantTapRealtimeEvent[],
  incoming: TenantTapRealtimeEvent,
  max = 40,
) {
  const withoutDup = previous.filter((row) => row.eventId !== incoming.eventId);
  return sortRealtimeEvents([incoming, ...withoutDup], max);
}
