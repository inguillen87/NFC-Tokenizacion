import type { ConsumerNetworkTap } from "./consumer-network-overview-truth";

/** A separate illustrative series: never reclassifies fixtures as operational taps. */
export function buildDemoTapTimeline(taps: ConsumerNetworkTap[], tenantSlug: string) {
  const unique = new Map<string, ConsumerNetworkTap>();
  for (const tap of taps) {
    if (tap.dataProvenance !== "declared_demo" || tap.tenantSlug !== tenantSlug) continue;
    if (!Number.isFinite(Date.parse(tap.createdAt))) continue;
    unique.set(tap.eventId, tap);
  }
  const records = [...unique.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const tap of records) hours[new Date(tap.createdAt).getUTCHours()].count += 1;
  return { records, hours, maxCount: Math.max(1, ...hours.map(({ count }) => count)) };
}
