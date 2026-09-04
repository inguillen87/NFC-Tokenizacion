import { classifyEventRiskBucket, isEventSecurityRisk } from "@product/core";
import { strictCoordinatePair } from "./geo-coordinates";

export type DashboardDemoEvent = {
  id: string;
  sequence: number;
  result: string;
  reason: string;
  uid_hex: string;
  bid: string;
  tenant_slug: string;
  city: string;
  country_code: string;
  lat: number;
  lng: number;
  product_name: string;
  device: string;
  vertical: string;
  mode: string;
  scenario: string;
  risk: number;
  source: string;
  created_at: string;
};

type DashboardDemoState = {
  sequence: number;
  updatedAt: string;
  events: DashboardDemoEvent[];
};

const runtimeKey = Symbol.for("nexid.dashboard.demoRuntimeState");

const demoCities = [
  { city: "Mendoza", country_code: "AR", lat: -32.8895, lng: -68.8458 },
  { city: "Valle de Uco", country_code: "AR", lat: -33.3667, lng: -69.15 },
  { city: "Buenos Aires", country_code: "AR", lat: -34.6037, lng: -58.3816 },
  { city: "San Martin", country_code: "AR", lat: -34.5744, lng: -58.5358 },
  { city: "Cordoba", country_code: "AR", lat: -31.4201, lng: -64.1888 },
  { city: "Rosario", country_code: "AR", lat: -32.9442, lng: -60.6505 },
];

const demoBaselineCreatedAt = Date.now();
const demoBaselineSpecs = [
  { id: "demo-baseline-valid-001", result: "VALID", minutesAgo: 4, cityIndex: 0, vertical: "wine", risk: 4 },
  { id: "demo-baseline-claim-001", result: "CLAIMED", minutesAgo: 11, cityIndex: 1, vertical: "cabernet", risk: 6 },
  { id: "demo-baseline-replay-001", result: "REPLAY_SUSPECT", minutesAgo: 19, cityIndex: 2, vertical: "chardonnay", risk: 82 },
  { id: "demo-baseline-tamper-001", result: "TAMPER", minutesAgo: 28, cityIndex: 3, vertical: "pinot", risk: 48 },
  { id: "demo-baseline-valid-002", result: "VALID", minutesAgo: 41, cityIndex: 4, vertical: "wine", risk: 3 },
  { id: "demo-baseline-valid-003", result: "VALID", minutesAgo: 52, cityIndex: 5, vertical: "cabernet", risk: 2 },
] as const;

function getState(): DashboardDemoState {
  const globalStore = globalThis as typeof globalThis & { [runtimeKey]?: DashboardDemoState };
  if (!globalStore[runtimeKey]) {
    globalStore[runtimeKey] = {
      sequence: 0,
      updatedAt: new Date().toISOString(),
      events: [],
    };
  }
  return globalStore[runtimeKey]!;
}

function normalizeResult(result: unknown, mode: unknown, scenario: unknown) {
  const rawResult = String(result || "").trim().toUpperCase();
  if (rawResult) return rawResult;
  const rawMode = String(mode || "").trim().toLowerCase();
  const rawScenario = String(scenario || "").trim().toLowerCase();
  if (rawScenario === "claim") return "CLAIMED";
  if (rawScenario === "redeem") return "REDEEMED";
  if (rawScenario === "checkin") return "CHECK_IN";
  if (rawMode === "tamper") return "TAMPER";
  if (rawMode === "replay") return "REPLAY_SUSPECT";
  return "VALID";
}

function reasonFor(result: string) {
  if (result === "REPLAY_SUSPECT") return "replay_detected";
  if (result === "TAMPER") return "tamper_opened";
  if (result === "CLAIMED") return "ownership_claimed";
  if (result === "REDEEMED") return "benefit_redeemed";
  if (result === "CHECK_IN") return "event_check_in";
  return "sun_ok";
}

function riskFor(result: string, risk: unknown) {
  const parsed = Number(risk);
  if (Number.isFinite(parsed)) return parsed;
  if (result === "REPLAY_SUSPECT") return 82;
  if (result === "TAMPER") return 48;
  return 4;
}

function productByVertical(vertical: string) {
  if (vertical === "cabernet") return "Cabernet Franc Reserva 2022";
  if (vertical === "chardonnay") return "Chardonnay de Altura 2023";
  if (vertical === "pinot") return "Pinot Noir Reserva 2022";
  return "Gran Reserva Malbec";
}

function isRiskEvent(event: Pick<DashboardDemoEvent, "result" | "reason">) {
  return isEventSecurityRisk({ result: event.result, reason: event.reason });
}

export function recordDashboardDemoEvent(input: Partial<DashboardDemoEvent> = {}) {
  const state = getState();
  const demoLocation = demoCities[state.sequence % demoCities.length] || demoCities[0];
  const reportedCoordinate = strictCoordinatePair(input.lat, input.lng);
  const result = normalizeResult(input.result, input.mode, input.scenario);
  const now = new Date().toISOString();
  const event: DashboardDemoEvent = {
    id: input.id || `demo-evt-${Date.now()}-${state.sequence + 1}`,
    sequence: state.sequence + 1,
    result,
    reason: input.reason || reasonFor(result),
    uid_hex: String(input.uid_hex || `04A7${String(1000 + state.sequence).padStart(4, "0")}1090`).toUpperCase(),
    bid: String(input.bid || "DEMO-2026-02"),
    tenant_slug: String(input.tenant_slug || "demobodega"),
    city: String(input.city || demoLocation.city),
    country_code: String(input.country_code || demoLocation.country_code),
    lat: reportedCoordinate?.lat ?? demoLocation.lat,
    lng: reportedCoordinate?.lng ?? demoLocation.lng,
    product_name: String(input.product_name || productByVertical(String(input.vertical || "wine"))),
    device: String(input.device || "iPhone demo tap"),
    vertical: String(input.vertical || "wine"),
    mode: String(input.mode || "valid"),
    scenario: String(input.scenario || "valid"),
    risk: riskFor(result, input.risk),
    source: String(input.source || "dashboard-demo-runtime"),
    created_at: input.created_at || now,
  };
  state.sequence = event.sequence;
  state.updatedAt = now;
  state.events = [event, ...state.events].slice(0, 160);
  return event;
}

export function generateDashboardDemoEvents(count = 8) {
  const results = ["VALID", "VALID", "VALID", "CLAIMED", "REPLAY_SUSPECT", "TAMPER"];
  const verticals = ["wine", "cabernet", "chardonnay", "pinot", "wine"];
  const events: DashboardDemoEvent[] = [];
  const bounded = Math.min(Math.max(Number(count) || 8, 1), 40);
  for (let index = 0; index < bounded; index += 1) {
    const result = results[index % results.length] || "VALID";
    events.push(
      recordDashboardDemoEvent({
        result,
        vertical: verticals[index % verticals.length] || "wine",
        mode: result === "TAMPER" ? "tamper" : result === "REPLAY_SUSPECT" ? "replay" : "valid",
        city: demoCities[index % demoCities.length]?.city,
        country_code: demoCities[index % demoCities.length]?.country_code,
        lat: demoCities[index % demoCities.length]?.lat,
        lng: demoCities[index % demoCities.length]?.lng,
      }),
    );
  }
  return events;
}

export function resetDashboardDemoEvents() {
  const state = getState();
  state.sequence = 0;
  state.updatedAt = new Date().toISOString();
  state.events = [];
}

export function getDashboardDemoEvents(limit = 80) {
  return getState().events.slice(0, Math.max(0, limit));
}

export function getDashboardDemoStreamEvents(limit = 80) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 80, 0), 160);
  if (!boundedLimit) return [] as DashboardDemoEvent[];
  const runtimeRows = getDashboardDemoEvents(boundedLimit);
  const runtimeIds = new Set(runtimeRows.map((row) => row.id));
  const baselineRows = demoBaselineSpecs
    .map((spec, index): DashboardDemoEvent => {
      const location = demoCities[spec.cityIndex] || demoCities[0];
      return {
        id: spec.id,
        sequence: -(index + 1),
        result: spec.result,
        reason: reasonFor(spec.result),
        uid_hex: `04D3A0${String(index + 1).padStart(2, "0")}1090`,
        bid: "BALMEC-DEMO-2026-02",
        tenant_slug: "demobodega",
        city: location.city,
        country_code: location.country_code,
        lat: location.lat,
        lng: location.lng,
        product_name: productByVertical(spec.vertical),
        device: "Dispositivo ilustrativo",
        vertical: spec.vertical,
        mode: spec.result === "TAMPER" ? "tamper" : spec.result === "REPLAY_SUSPECT" ? "replay" : "valid",
        scenario: spec.result === "CLAIMED" ? "claim" : "valid",
        risk: spec.risk,
        source: "dashboard-demo-baseline",
        created_at: new Date(demoBaselineCreatedAt - spec.minutesAgo * 60_000).toISOString(),
      };
    })
    .filter((row) => !runtimeIds.has(row.id));
  return [...runtimeRows, ...baselineRows].slice(0, boundedLimit);
}

export function toDemoAdminEventRow(event: DashboardDemoEvent) {
  return {
    id: event.id,
    event_type: "DEMO_TAP_SIMULATED",
    result: event.result,
    reason: event.reason,
    uid_hex: event.uid_hex,
    created_at: event.created_at,
    city: event.city,
    country_code: event.country_code,
    lat: event.lat,
    lng: event.lng,
    bid: event.bid,
    tenant_slug: event.tenant_slug,
    product_name: event.product_name,
    device: event.device,
    source: "demo",
  };
}

export function toDemoRealtimeEvent(event: DashboardDemoEvent) {
  const uid = String(event.uid_hex || "").toUpperCase();
  const occurredAt = String(event.created_at || new Date().toISOString());
  return {
    eventId: event.id,
    tenantId: null,
    tenantSlug: event.tenant_slug,
    batchId: event.bid,
    tagId: null,
    uidMasked: uid ? `${uid.slice(0, 4)}****${uid.slice(-2)}` : "N/A",
    occurredAt,
    occurredAtUtc: occurredAt,
    occurredAtLocal: occurredAt,
    timezone: "UTC",
    timezoneLabel: "UTC",
    timezoneOffset: "+00:00",
    eventType: "DEMO_TAP_SIMULATED",
    result: event.result,
    verdict: event.result === "VALID" || event.result === "CLAIMED" ? "valid" : event.result.toLowerCase(),
    interactionClass: "unclassified_activity" as const,
    productIdentityRecognized: false,
    authenticationVerified: false,
    knownActorCount: 0,
    knownActor: false,
    commercialConsentGranted: false,
    commercialConsentChannels: [],
    riskLevel: event.risk >= 80 ? "high" : event.risk >= 40 ? "medium" : "none",
    city: event.city,
    country: event.country_code,
    lat: event.lat,
    lng: event.lng,
    deviceLabel: event.device,
    productName: event.product_name,
    source: "demo" as const,
    eventSource: "demo",
    stream_sent_at: new Date().toISOString(),
    stream_latency_ms: Math.max(8, Math.min(180, 20 + event.sequence * 3)),
    origin_trace_id: event.id,
  };
}

export function toDemoFeedRow(event: DashboardDemoEvent) {
  return {
    id: event.id,
    uidHex: event.uid_hex,
    bid: event.bid,
    result: event.result === "VALID" || event.result === "CLAIMED" ? "ok" : event.result.toLowerCase(),
    city: event.city,
    country: event.country_code,
    device: event.device,
    productName: event.product_name,
    createdAt: event.created_at,
  };
}

export function aggregateDemoGeoPoints(events: DashboardDemoEvent[]) {
  const byKey = new Map<string, { city: string; country: string; scans: number; risk: number; lat: number; lng: number }>();
  for (const event of events) {
    const key = `${event.city}:${event.country_code}`;
    const current = byKey.get(key);
    if (current) {
      current.scans += 1;
      if (isRiskEvent(event)) current.risk += 1;
    } else {
      byKey.set(key, {
        city: event.city,
        country: event.country_code,
        scans: 1,
        risk: isRiskEvent(event) ? 1 : 0,
        lat: event.lat,
        lng: event.lng,
      });
    }
  }
  return Array.from(byKey.values()).map((point) => ({
    ...point,
    risk: point.scans ? Number(((point.risk / point.scans) * 100).toFixed(1)) : 0,
  }));
}

export function mergeDemoGeoPoints<T extends { city: string; country?: string; scans?: number; risk?: number; lat: number; lng: number }>(
  base: T[],
  demo: ReturnType<typeof aggregateDemoGeoPoints>,
) {
  const byKey = new Map<string, T & { country?: string; scans: number; risk: number }>();
  for (const point of base) {
    byKey.set(`${point.city}:${point.country || "--"}`, {
      ...point,
      country: point.country || "--",
      scans: Number(point.scans || 0),
      risk: Number(point.risk || 0),
    });
  }
  for (const point of demo) {
    const key = `${point.city}:${point.country}`;
    const current = byKey.get(key);
    if (current) {
      current.scans = Number(current.scans || 0) + point.scans;
      current.risk = Math.max(Number(current.risk || 0), point.risk);
    } else {
      byKey.set(key, point as T & { country?: string; scans: number; risk: number });
    }
  }
  return Array.from(byKey.values());
}

export function mergeDemoTrend<T extends { day: string; scans: number; duplicates: number; tamper: number }>(
  base: T[],
  events: DashboardDemoEvent[],
) {
  const byDay = new Map<string, T>();
  for (const row of base) byDay.set(row.day, { ...row });
  for (const event of events) {
    const day = event.created_at.slice(0, 10);
    const current = byDay.get(day) || ({ day, scans: 0, duplicates: 0, tamper: 0 } as T);
    current.scans += 1;
    if (event.result === "REPLAY_SUSPECT") current.duplicates += 1;
    if (event.result === "TAMPER") current.tamper += 1;
    byDay.set(day, current);
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day)).slice(-30);
}

export function demoRuntimeSummary(events: DashboardDemoEvent[]) {
  const scans = events.length;
  const risk = events.filter(isRiskEvent).length;
  const buckets = events.map((event) => classifyEventRiskBucket({ result: event.result, reason: event.reason }));
  const valid = buckets.filter((bucket) => bucket === "valid").length;
  return {
    scans,
    valid,
    invalid: buckets.filter((bucket) => bucket === "invalid").length,
    duplicates: buckets.filter((bucket) => bucket === "duplicate_replay").length,
    tamper: buckets.filter((bucket) => bucket === "tamper").length,
    risk,
  };
}
