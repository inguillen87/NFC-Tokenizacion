import type { DashboardDemoEvent } from "./demo-runtime-state";
import type { DashboardIncident, DashboardIncidentHistory } from "./incident-workflow";

const DEMO_TENANTS = new Set(["demobodega", "demoevents", "demo-sandbox"]);
const INCIDENT_STATUSES = new Set(["open", "investigating", "contained", "resolved", "dismissed"]);

function replayExample(events: readonly DashboardDemoEvent[]) {
  const event = events.find((row) => row.id === "demo-baseline-replay-001"
    && row.tenant_slug === "demobodega" && row.source === "dashboard-demo-baseline");
  if (!event || !Number.isFinite(Date.parse(event.created_at))) return null;
  const openedAt = new Date(Date.parse(event.created_at) + 60_000).toISOString();
  const updatedAt = new Date(Date.parse(event.created_at) + 11 * 60_000).toISOString();
  const incident: DashboardIncident = {
    id: "demo-incident-replay-001", tenantId: "demo-tenant-001", tenantSlug: "demobodega",
    eventId: event.id, ticketId: "DEMO-RISK-001", ticketStatus: "open",
    status: "investigating", severity: "high",
    title: "Repetición de lectura para revisar",
    summary: "Caso ilustrativo: el mismo identificador fue leído nuevamente y el equipo revisa el contexto antes de actuar. No representa una investigación real.",
    openedAt, resolvedAt: null, createdAt: openedAt, updatedAt, version: 2,
    evidence: {
      result: event.result, verdict: "replay_suspect", reason: event.reason, riskLevel: "high",
      uidMasked: "04D3****90", bid: event.bid, occurredAt: event.created_at,
      city: event.city, country: event.country_code, source: "demo",
    },
  };
  const actor = { actorId: "demo-operator-001", actorEmail: "", actorLabel: "Operador ficticio · Demo" };
  const history: DashboardIncidentHistory[] = [
    {
      id: "demo-incident-history-001", action: "opened", fromStatus: null, toStatus: "open",
      fromSeverity: null, toSeverity: "high", ...actor,
      reason: "Ejemplo: el equipo abre una revisión vinculada a esta lectura ilustrativa.", createdAt: openedAt,
    },
    {
      id: "demo-incident-history-002", action: "transitioned", fromStatus: "open", toStatus: "investigating",
      fromSeverity: "high", toSeverity: "high", ...actor,
      reason: "Ejemplo: se revisan el producto, el lote y el contexto antes de decidir una acción.", createdAt: updatedAt,
    },
  ];
  return { incident, history };
}

/** Read-only demo adapter. Its caller must establish a demo session before selecting this data source. */
export function demoIncidentResource(
  method: string,
  path: string,
  tenant: string,
  search: URLSearchParams,
  events: readonly DashboardDemoEvent[],
): { status: number; body: Record<string, unknown> } | null {
  const [namespace, incidentId, extra] = path.split("/");
  if (namespace !== "incidents") return null;
  const envelope = { demoMode: true, dataSource: "demo", scope: { tenant, source: "demo" } };
  const error = (status: number, reason: string) => ({ status, body: { ...envelope, ok: false, reason } });
  if (method !== "GET") return error(405, "demo_read_only");
  if (!DEMO_TENANTS.has(tenant)) return error(403, "demo_tenant_required");
  const requestedTenant = String(search.get("tenant") || "").trim().toLowerCase();
  if (requestedTenant && requestedTenant !== tenant) return error(403, "incident_tenant_scope_mismatch");
  if (extra !== undefined || incidentId === "") return error(404, "incident_not_found");

  const detail = tenant === "demobodega" ? replayExample(events) : null;
  if (incidentId !== undefined) {
    if (!detail || incidentId !== detail.incident.id) return error(404, "incident_not_found");
    return { status: 200, body: { ...envelope, ok: true, ...detail } };
  }

  const eventId = String(search.get("eventId") || search.get("event_id") || "").trim();
  const status = String(search.get("status") || "").trim().toLowerCase();
  const rawLimit = Number(search.get("limit") || 50);
  if (eventId.length > 128 || (eventId && !/^[a-zA-Z0-9_-]+$/.test(eventId))) return error(400, "incident_event_id_invalid");
  if (status && !INCIDENT_STATUSES.has(status)) return error(400, "incident_status_invalid");
  if (!Number.isFinite(rawLimit)) return error(400, "incident_limit_invalid");
  const incidents = (detail ? [detail.incident] : [])
    .filter((row) => (!eventId || row.eventId === eventId) && (!status || row.status === status))
    .slice(0, Math.min(200, Math.max(1, Math.trunc(rawLimit))));
  return { status: 200, body: { ...envelope, ok: true, count: incidents.length, incidents } };
}
