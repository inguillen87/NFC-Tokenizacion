import { METRIC_LABEL } from "./usage-health-catalog";
export const WINDOWS = ["1h", "24h", "7d", "30d"] as const;
export type HealthWindow = typeof WINDOWS[number];
export const SERVICE_IDS = ["sun", "canonical_event_outbox", "webhooks", "incidents", "polygon_queue", "iota_queue"] as const;
export type ServiceId = typeof SERVICE_IDS[number];
export type HealthState = "healthy" | "breach" | "insufficient_data" | "no_data" | "ticket" | "page" | "unavailable";
export type Reading<T> = { state: "ready"; data: T; checkedAt: string } | { state: "not_requested" | "forbidden" | "demo" | "unavailable" | "invalid" | "timeout"; data: null; checkedAt: string };
export type HealthIndicator = {
  id: string; target: number; minimumSample: number; eligibleEvents: number | null;
  goodEvents: number | null; badEvents: number | null; ratio: number | null;
  errorBudgetRemaining: number | null; burnRate: number | null; state: HealthState;
};
export type HealthSignal = { id: string; value: number; unit: "count" | "seconds"; warningThreshold: number; criticalThreshold: number; state: "healthy" | "ticket" | "page" };
export type HealthService = { id: ServiceId; availability: "ready" | "unavailable"; indicators: HealthIndicator[]; signals: HealthSignal[] };
export type HealthSnapshot = {
  schemaVersion: "nexid.usage-health.projection.v1"; observedAt: string;
  scope: "tenant" | "global"; window: { id: HealthWindow; startsAt: string; endsAt: string };
  services: HealthService[];
};
export type SdkUsage = { monthRequests: number; avgLatencyMs: number | null };
export function healthWindow(value: unknown): HealthWindow {
  return typeof value === "string" && WINDOWS.includes(value as HealthWindow) ? value as HealthWindow : "24h";
}
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_record");
  return value as RecordValue;
};
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const ratio = (value: unknown): value is number => finite(value) && value <= 1;
const iso = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const assert = (condition: unknown): void => { if (!condition) throw new Error("invalid_contract"); };
const states: HealthState[] = ["healthy", "breach", "insufficient_data", "no_data", "ticket", "page", "unavailable"];
function metricId(value: unknown, service: ServiceId): string {
  assert(typeof value === "string" && /^[a-z][a-z0-9_.-]{1,95}$/.test(value) && value.startsWith(service + "."));
  assert(Object.hasOwn(METRIC_LABEL,value as string));
  return value as string;
}
function parseIndicator(value: unknown, service: ServiceId, window: HealthWindow, unavailable: boolean): HealthIndicator {
  const p = record(value); const id = metricId(p.id, service);
  assert(p.source === "persisted_database_aggregate" && p.evaluationWindow === window);
  assert(ratio(p.target) && p.target > 0 && p.target < 1 && integer(p.minimumSample) && p.minimumSample > 0);
  assert(states.includes(p.state as HealthState));
  if (unavailable) {
    assert(p.state === "unavailable" && [p.eligibleEvents,p.goodEvents,p.badEvents,p.ratio,p.errorBudgetRemaining,p.burnRate].every(v => v === null));
  } else {
    assert(p.state !== "unavailable" && integer(p.eligibleEvents) && integer(p.goodEvents) && integer(p.badEvents));
    assert(Number(p.goodEvents) + Number(p.badEvents) === p.eligibleEvents);
    if (p.eligibleEvents === 0) assert(p.state === "no_data" && p.ratio === null && p.errorBudgetRemaining === null && p.burnRate === null);
    else {
      assert(ratio(p.ratio) && ratio(p.errorBudgetRemaining) && finite(p.burnRate) && p.state !== "no_data");
      assert(Math.abs(Number(p.ratio) - Number(p.goodEvents)/Number(p.eligibleEvents)) <= 0.000002);
      if (p.state === "healthy") assert(Number(p.eligibleEvents) >= Number(p.minimumSample) && Number(p.ratio) >= Number(p.target) - 0.000002);
      if (p.state === "insufficient_data") assert(Number(p.eligibleEvents) < Number(p.minimumSample));
    }
  }
  return {id,target:p.target as number,minimumSample:p.minimumSample as number,eligibleEvents:p.eligibleEvents as number|null,goodEvents:p.goodEvents as number|null,badEvents:p.badEvents as number|null,ratio:p.ratio as number|null,errorBudgetRemaining:p.errorBudgetRemaining as number|null,burnRate:p.burnRate as number|null,state:p.state as HealthState};
}
/** Whitelist projection: never forward arbitrary upstream text, keys, payloads or identities. */
export function parseHealthSnapshot(value: unknown, scope: "tenant" | "global", window: HealthWindow): HealthSnapshot | null {
  try {
    const p=record(value), provenance=record(p.provenance), policy=record(p.alertPolicy), period=record(p.window);
    assert(p.ok===true && p.schemaVersion==="nexid.service-levels.v1");
    assert(provenance.source==="persisted_database_aggregates" && provenance.synthetic===false && provenance.fixtures===false && provenance.demoExcluded===true);
    assert(policy.automated===false && policy.snapshotAlertsAreCandidates===true);
    assert(record(p.scope).kind===scope && period.id===window && iso(p.observedAt) && iso(period.startsAt) && iso(period.endsAt));
    assert(Date.parse(String(period.startsAt))<Date.parse(String(period.endsAt)) && Date.parse(String(period.endsAt))<=Date.parse(String(p.observedAt))+1000);
    assert(Array.isArray(p.services) && p.services.length===SERVICE_IDS.length && Array.isArray(p.alerts));
    const services=(p.services as unknown[]).map(value=>{
      const s=record(value); assert(SERVICE_IDS.includes(s.id as ServiceId)); const id=s.id as ServiceId;
      assert(s.availability==="ready" || s.availability==="unavailable");
      assert(Array.isArray(s.indicators) && s.indicators.length>=1 && s.indicators.length<=8 && Array.isArray(s.signals) && s.signals.length<=16);
      const indicators=(s.indicators as unknown[]).map(v=>parseIndicator(v,id,window,s.availability==="unavailable"));
      const signals=(s.signals as unknown[]).map(value=>{
        const v=record(value);assert(s.availability==="ready" && v.source==="persisted_database_aggregate");
        assert(finite(v.value) && finite(v.warningThreshold) && finite(v.criticalThreshold) && v.criticalThreshold>=v.warningThreshold);
        assert(v.unit==="count" || v.unit==="seconds"); if(v.unit==="count")assert(integer(v.value));
        const state=Number(v.value)>=Number(v.criticalThreshold)?"page":Number(v.value)>=Number(v.warningThreshold)?"ticket":"healthy";
        assert(v.state===state);
        return {id:metricId(v.id,id),value:v.value as number,unit:v.unit as "count"|"seconds",warningThreshold:v.warningThreshold as number,criticalThreshold:v.criticalThreshold as number,state};
      });
      assert(new Set([...indicators,...signals].map(v=>v.id)).size===indicators.length+signals.length);
      return {id,availability:s.availability,indicators,signals} as HealthService;
    });
    assert(new Set(services.map(s=>s.id)).size===SERVICE_IDS.length);
    return {schemaVersion:"nexid.usage-health.projection.v1",observedAt:p.observedAt as string,scope,window:{id:window,startsAt:period.startsAt as string,endsAt:period.endsAt as string},services};
  } catch { return null; }
}
export function parseSdkUsage(value: unknown, tenant: string): SdkUsage | null {
  try {
    const p=record(value), usage=record(p.usage);
    assert(p.ok===true && (tenant ? record(p.tenant).slug===tenant : p.tenant===null));
    assert(integer(usage.monthRequests) && finite(usage.avgLatencyMs));
    return {monthRequests:usage.monthRequests as number,avgLatencyMs:usage.monthRequests===0 ? null : usage.avgLatencyMs as number};
  } catch { return null; }
}
export const needsAttention = (state: HealthState) => ["page","ticket","breach","unavailable"].includes(state);
export function serviceState(service: HealthService): HealthState {
  if(service.availability==="unavailable")return "unavailable";
  const values=[...service.indicators,...service.signals].map(v=>v.state);
  for(const state of ["page","ticket","breach","insufficient_data"] as const)if(values.includes(state))return state;
  if(service.indicators.every(i=>i.state==="no_data"))return "no_data";
  return "healthy";
}
export function healthSummary(snapshot: HealthSnapshot | null) {
  if(!snapshot)return null;
  const sun=snapshot.services.find(s=>s.id==="sun")?.indicators.find(i=>i.id==="sun.persisted_adjudication_completeness");
  return {responding:snapshot.services.filter(s=>s.availability==="ready").length,total:snapshot.services.length,attention:snapshot.services.filter(s=>needsAttention(serviceState(s))).length,sunRecords:sun?.eligibleEvents ?? null,sunComplete:sun?.goodEvents ?? null};
}
export function diagnosticEvidence(snapshot: HealthSnapshot, usage: Reading<SdkUsage>, checkedAt: string) {
  return {format:"nexid.operational-support.v1",checkedAt,scope:snapshot.scope,observedAt:snapshot.observedAt,window:{id:snapshot.window.id,startsAt:snapshot.window.startsAt,endsAt:snapshot.window.endsAt},services:snapshot.services.map(s=>({id:s.id,state:serviceState(s),indicators:s.indicators.map(i=>({id:i.id,eligible:i.eligibleEvents,good:i.goodEvents,bad:i.badEvents,state:i.state})),signals:s.signals.map(v=>({id:v.id,value:v.value,unit:v.unit,state:v.state}))})),sdk:usage.state==="ready"?{monthRequests:usage.data.monthRequests,avgLatencyMs:usage.data.avgLatencyMs,checkedAt:usage.checkedAt}:null,limits:{runtimeAvailabilityMeasured:false,costMeasured:false,automaticPaging:false,prePersistenceFailuresMeasured:false}};
}
