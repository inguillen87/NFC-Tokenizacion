import { classifyRealtimeVerdict, isRealtimeRisk, type TenantTapRealtimeEvent } from "./realtime-feed";

export type DashboardIncidentStatus = "open" | "investigating" | "contained" | "resolved" | "dismissed";
export type DashboardIncidentSeverity = "low" | "medium" | "high" | "critical";

const INCIDENT_STATUS_LABELS: Record<DashboardIncidentStatus, string> = {
  open: "Abierto",
  investigating: "En investigación",
  contained: "Contenido",
  resolved: "Resuelto",
  dismissed: "Descartado",
};

export function incidentStatusLabel(status: unknown): string {
  return typeof status === "string" && Object.prototype.hasOwnProperty.call(INCIDENT_STATUS_LABELS, status)
    ? INCIDENT_STATUS_LABELS[status as DashboardIncidentStatus]
    : "Estado no informado";
}

export type DashboardIncident = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  eventId: string;
  ticketId: string;
  ticketStatus: string | null;
  status: DashboardIncidentStatus;
  severity: DashboardIncidentSeverity;
  title: string;
  summary: string;
  openedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  idempotentReplay?: boolean;
  evidence?: {
    result: string;
    verdict: string;
    reason: string | null;
    riskLevel: string;
    uidMasked: string;
    bid: string | null;
    occurredAt: string | null;
    city: string | null;
    country: string | null;
    source: string;
  };
};

export type DashboardIncidentHistory = {
  id: string;
  action: "opened" | "transitioned" | "severity_changed";
  fromStatus: DashboardIncidentStatus | null;
  toStatus: DashboardIncidentStatus;
  fromSeverity: DashboardIncidentSeverity | null;
  toSeverity: DashboardIncidentSeverity;
  actorId: string;
  actorEmail: string;
  actorLabel: string;
  reason: string;
  createdAt: string;
};

export type IncidentRealtimeWireEvent = {
  event_type: "incident.created" | "incident.updated";
  incident_id: string;
  incident_event_id: string;
  ticket_id: string;
  tenant_id?: string | null;
  tenant_slug?: string | null;
  incident_status: DashboardIncidentStatus;
  incident_severity: DashboardIncidentSeverity;
  incident_title: string;
  created_at: string;
};

export function isIncidentRealtimeWireEvent(value: unknown): value is IncidentRealtimeWireEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const eventType = String(row.event_type || "");
  return (eventType === "incident.created" || eventType === "incident.updated")
    && Boolean(String(row.incident_id || ""))
    && Boolean(String(row.incident_event_id || ""));
}

export function incidentByEvent(rows: DashboardIncident[]) {
  return Object.fromEntries(rows.map((incident) => [String(incident.eventId), incident]));
}

export function recommendedIncidentSeverity(event: TenantTapRealtimeEvent): DashboardIncidentSeverity {
  const risk = String(event.riskLevel || "").toLowerCase();
  const verdict = String(event.verdict || "").toUpperCase();
  if (risk === "critical" || ["REVOKED", "BROKEN"].includes(verdict)) return "critical";
  if (risk === "high" || ["REPLAY_SUSPECT", "BLOCKED_REPLAY", "TAMPER", "TAMPERED"].includes(verdict)) return "high";
  if (risk === "medium" || isRealtimeRisk(event.verdict, event.reason)) return "medium";
  return "low";
}

export function deterministicIncidentExplanation(event: TenantTapRealtimeEvent) {
  const bucket = classifyRealtimeVerdict(event.verdict, event.reason);
  const result = String(event.verdict || "UNKNOWN").toUpperCase();
  const reason = String(event.reason || "sin motivo técnico informado");
  const location = event.city || event.country
    ? `${event.city || "zona no informada"}, ${event.country || "país no informado"}`
    : "sin ubicación reportada";
  const severity = recommendedIncidentSeverity(event);
  const decision = bucket === "duplicate_replay"
    ? "El motor clasificó una reutilización o replay; hay que revisar contador, UID y secuencia del lote."
    : bucket === "tamper"
      ? "El evento contiene una señal explícita de manipulación; conviene preservar evidencia física y digital."
      : bucket === "invalid"
        ? "La validación no fue aceptada; hay que confirmar configuración, estado del tag y autenticidad del mensaje."
        : bucket === "valid"
          ? "La lectura fue válida. Abrí un incidente sólo si existe contexto operativo adicional que requiera investigación."
          : "La taxonomía no permite afirmar fraude ni validez; requiere clasificación humana antes de decidir.";
  return {
    severity,
    title: `Investigación del evento ${event.eventId}`,
    summary: `${result}: ${reason}. UID ${event.uidMasked}; ${location}.`,
    decision,
    facts: [
      `Resultado canónico: ${result}`,
      `Motivo registrado: ${reason}`,
      `Riesgo declarado: ${event.riskLevel || "no informado"}`,
      `Origen: ${event.eventSource || event.source || "no informado"}`,
      `Ubicación: ${location}`,
    ],
  };
}

export function allowedIncidentTransitions(status: DashboardIncidentStatus): DashboardIncidentStatus[] {
  if (status === "open") return ["investigating", "contained", "dismissed"];
  if (status === "investigating") return ["contained", "resolved", "dismissed"];
  if (status === "contained") return ["investigating", "resolved", "dismissed"];
  return ["investigating"];
}
