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

export function mergeRealtimeEvents(
  previous: TenantTapRealtimeEvent[],
  incoming: TenantTapRealtimeEvent,
  max = 40,
) {
  const withoutDup = previous.filter((row) => row.eventId !== incoming.eventId);
  return [incoming, ...withoutDup].slice(0, max);
}
