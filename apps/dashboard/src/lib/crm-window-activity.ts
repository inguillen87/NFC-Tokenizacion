import { strictCoordinatePair } from "./geo-coordinates";
import { classifyLocationProvenance } from "./location-provenance";
import { isRealtimeRisk, type TenantTapRealtimeEvent } from "./realtime-feed";

export type CrmWindowLocationSource = "gps" | "network" | "mixed" | "other" | "unlocated";
export type CrmWindowActivitySources = Record<CrmWindowLocationSource, number>;

export type CrmWindowActivityZone = CrmWindowActivitySources & {
  key: string;
  label: string;
  total: number;
  events: TenantTapRealtimeEvent[];
};

export type CrmWindowActivityProduct = {
  key: string;
  label: string;
  total: number;
  events: TenantTapRealtimeEvent[];
};

export type CrmWindowActivityQueueItem = {
  event: TenantTapRealtimeEvent;
  signal: "risk" | "opened" | "activity";
  risk: boolean;
  opened: boolean;
};

type CrmWindowActivityCollections = {
  events: TenantTapRealtimeEvent[];
  zones: CrmWindowActivityZone[];
  products: CrmWindowActivityProduct[];
  queue: CrmWindowActivityQueueItem[];
};

export type CrmWindowActivity = CrmWindowActivityCollections & (
  | {
    state: "pending";
    total: null;
    eligibleActivity: null;
    risk: null;
    opened: null;
    sources: null;
  }
  | {
    state: "ready";
    total: number;
    eligibleActivity: number;
    risk: number;
    opened: number;
    sources: CrmWindowActivitySources;
  }
);

// Closed vocabulary shared by physical-taps-contract.ts and the API's
// physical-tap projection. An opening is reported state, not a security risk.
const OPENED_RESULTS = new Set([
  "OPENED",
  "OPENED_PREVIOUSLY",
  "MANUAL_OPENED",
  "VALID_OPENED",
  "VALID_OPENED_PREVIOUSLY",
  "VALID_MANUAL_OPENED",
]);
const ACTIONABLE_INTERACTION_TYPES = new Set(["TAP_VALID", "PROVENANCE_VIEWED"]);
const SIGNAL_ORDER = { risk: 0, opened: 1, activity: 2 } as const;
// Missing-location placeholders emitted by /admin/events and its demo adapter.
const MISSING_CITIES = new Set(["unknown", "no informada"]);

function sourceCounts(): CrmWindowActivitySources {
  return { gps: 0, network: 0, mixed: 0, other: 0, unlocated: 0 };
}

function reportedText(value?: string | null) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function reportedGeography(event: TenantTapRealtimeEvent) {
  const city = reportedText(event.city);
  const country = reportedText(event.country);
  return {
    city: MISSING_CITIES.has(city.toLowerCase()) ? "" : city,
    country: country === "--" ? "" : country,
  };
}

function locationSource(event: TenantTapRealtimeEvent): CrmWindowLocationSource {
  const coordinate = strictCoordinatePair(event.lat, event.lng);
  const { city, country } = reportedGeography(event);
  const hasReportedZone = Boolean(city || country);
  if (!coordinate && !hasReportedZone) return "unlocated";

  const provenance = classifyLocationProvenance(event.locationSource);
  if (provenance === "consented_gps") return coordinate ? "gps" : "other";
  if (provenance === "network_approx") return "network";
  if (provenance === "mixed_approx") return "mixed";
  return "other";
}

function reportedZone(event: TenantTapRealtimeEvent): { key: string; label: string } {
  const { city, country } = reportedGeography(event);
  if (city || country) {
    return {
      key: `reported:${JSON.stringify([city.toLowerCase(), country.toLowerCase()])}`,
      label: city ? [city, country].filter(Boolean).join(", ") : `${country} · ciudad no informada`,
    };
  }
  if (strictCoordinatePair(event.lat, event.lng)) {
    return { key: "coordinate-only", label: "Coordenada reportada · ciudad no informada" };
  }
  return { key: "unlocated", label: "Sin ubicación informada" };
}

function isEligibleActivity(event: TenantTapRealtimeEvent) {
  return event.productIdentityRecognized === true
    && event.interactionClass !== "security_signal"
    && event.knownActor === true
    && event.commercialConsentGranted === true
    && Array.isArray(event.commercialConsentChannels)
    && event.commercialConsentChannels.length > 0
    && ACTIONABLE_INTERACTION_TYPES.has(String(event.eventType || "").toUpperCase());
}

/**
 * Aggregate the already normalized and scoped event window. Scope, source and
 * the upstream sample limit belong to the caller; this helper neither fetches
 * nor deduplicates, truncates or invents events, product units or people.
 */
export function buildCrmWindowActivity(
  events: readonly TenantTapRealtimeEvent[],
  options: { confirmed: boolean },
): CrmWindowActivity {
  if (options.confirmed !== true) {
    return {
      state: "pending",
      total: null,
      eligibleActivity: null,
      risk: null,
      opened: null,
      sources: null,
      events: [],
      zones: [],
      products: [],
      queue: [],
    };
  }

  const sources = sourceCounts();
  const zones = new Map<string, CrmWindowActivityZone>();
  const products = new Map<string, CrmWindowActivityProduct>();
  const queue: CrmWindowActivityQueueItem[] = [];
  let eligibleActivity = 0;
  let risk = 0;
  let opened = 0;

  for (const event of events) {
    const source = locationSource(event);
    sources[source] += 1;

    const zone = reportedZone(event);
    const zoneActivity: CrmWindowActivityZone = zones.get(zone.key) || { ...zone, ...sourceCounts(), total: 0, events: [] };
    zoneActivity.total += 1;
    zoneActivity[source] += 1;
    zoneActivity.events.push(event);
    zones.set(zone.key, zoneActivity);

    const productName = reportedText(event.productName);
    const productKey = `product:${productName.toLowerCase()}`;
    const productActivity: CrmWindowActivityProduct = products.get(productKey) || {
      key: productKey,
      label: productName || "Producto no informado",
      total: 0,
      events: [],
    };
    productActivity.total += 1;
    productActivity.events.push(event);
    products.set(productKey, productActivity);

    const eventRisk = isRealtimeRisk(event);
    const eventOpened = [event.result, event.verdict, event.eventType]
      .some((value) => OPENED_RESULTS.has(String(value || "").trim().toUpperCase()));
    risk += Number(eventRisk);
    opened += Number(eventOpened);
    eligibleActivity += Number(isEligibleActivity(event));
    queue.push({
      event,
      signal: eventRisk ? "risk" : eventOpened ? "opened" : "activity",
      risk: eventRisk,
      opened: eventOpened,
    });
  }

  return {
    state: "ready",
    events: [...events],
    total: events.length,
    eligibleActivity,
    risk,
    opened,
    sources,
    // Stable sorting preserves input recency for ties, without inventing dates.
    zones: [...zones.values()].sort((left, right) => right.total - left.total),
    products: [...products.values()].sort((left, right) => right.total - left.total),
    queue: queue.sort((left, right) => SIGNAL_ORDER[left.signal] - SIGNAL_ORDER[right.signal]),
  };
}
