import type { PhysicalTapsResult, PhysicalTapRow } from "./physical-taps-contract";
import type { TenantTapRealtimeEvent } from "./realtime-feed";
import { strictCoordinatePair } from "./geo-coordinates";
import { isRealtimeRisk } from "./realtime-feed";

export function mapRange(value: unknown): "24h" | "7d" | "30d" {
  return value === "7d" || value === "30d" ? value : "24h";
}
export function physicalMapModel(result: PhysicalTapsResult, expectedTenant = "", query = "", seal = "all", country = "") {
  const payload = result.availability === "ready" ? result.payload : null;
  const scopeMatches = !expectedTenant || (payload?.scope.tenant === expectedTenant && payload.rows.every(row => row.tenantSlug === expectedTenant));
  const confirmed = Boolean(payload && payload.scope.source === "real" && scopeMatches && payload.rows.every(row => row.source === "real" && row.dataMode === "physical_real"));
  const seen = new Set<string>();
  const sample = confirmed ? payload!.rows.filter(row => { if (seen.has(row.eventId)) return false; seen.add(row.eventId); return true; }) : [];
  const search = query.trim().toLocaleLowerCase();
  const rows = sample.filter(row => (!country || row.location.country.toUpperCase() === country.toUpperCase()) && (seal === "all" || row.sealState === seal) && (!search || [row.bid, row.productName, row.uidMasked, row.location.city, row.location.country].join(" ").toLocaleLowerCase().includes(search)));
  const events: TenantTapRealtimeEvent[] = rows.filter(row => row.location.evidence === "persisted_event" && strictCoordinatePair(row.location.lat, row.location.lng)).map(row => ({
    eventId: row.eventId, tenantId: null, tenantSlug: row.tenantSlug, batchId: null, bid: row.bid, tagId: null,
    uidMasked: row.uidMasked, occurredAt: row.occurredAt.utc, occurredAtUtc: row.occurredAt.utc,
    occurredAtLocal: row.occurredAt.local, timezone: row.occurredAt.timezone, timezoneLabel: row.occurredAt.label, timezoneOffset: null,
    eventType: "nfc_tap", result: row.result, verdict: row.verdict,
    interactionClass: row.messageValid ? "authentication_verified" : "unclassified_activity",
    productIdentityRecognized: false, authenticationVerified: row.messageValid && row.evidence.messageAuthentication === "validated",
    knownActorCount: 0, knownActor: false, commercialConsentGranted: false, commercialConsentChannels: [], riskLevel: "unknown",
    city: row.location.city, country: row.location.country, lat: row.location.lat, lng: row.location.lng,
    locationSource: row.location.source, locationAccuracyM: row.location.accuracyM, productName: row.productName,
    source: "production", eventSource: "persisted_physical_taps",
  }));
  const buckets = new Map<string, { key: string; city: string; country: string; taps: number; valid: number; risk: number }>();
  for (const event of events) {
    const key = JSON.stringify([event.city, event.country]);
    const point = buckets.get(key) || { key, city: event.city || "Sin ciudad", country: event.country || "—", taps: 0, valid: 0, risk: 0 };
    point.taps++; if (event.authenticationVerified) point.valid++; if (isRealtimeRisk(event)) point.risk++; buckets.set(key, point);
  }
  return { confirmed, rows, events, hotspots: [...buckets.values()].sort((a,b) => b.taps-a.taps), sampleSize: sample.length, withoutCoordinates: rows.length-events.length, limit: payload?.scope.limit ?? 100 };
}
export function sealLabel(row: Pick<PhysicalTapRow, "sealState">) {
  return row.sealState === "closed" ? "Cerrado reportado" : row.sealState === "opened" ? "Abierto reportado" : "Sin estado concluyente";
}
