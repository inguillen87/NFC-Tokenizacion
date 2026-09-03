import { sql } from "./db";

export const INCIDENT_STATUSES = ["open", "investigating", "contained", "resolved", "dismissed"] as const;
export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

type IncidentQuery = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

export type EventIncident = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  eventId: string;
  ticketId: string;
  ticketStatus: string | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  title: string;
  summary: string;
  openedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  idempotentReplay: boolean;
  evidence: {
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

export type IncidentHistoryEntry = {
  id: string;
  action: "opened" | "transitioned" | "severity_changed";
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  fromSeverity: IncidentSeverity | null;
  toSeverity: IncidentSeverity;
  actorId: string;
  actorEmail: string;
  actorLabel: string;
  reason: string;
  createdAt: string;
};

function text(value: unknown) {
  return String(value ?? "");
}

function nullableText(value: unknown) {
  const normalized = text(value).trim();
  return normalized || null;
}

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

export function maskIncidentUid(value: unknown) {
  const uid = text(value).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!uid) return "no disponible";
  if (uid.length <= 8) return `${uid.slice(0, 4)}****`;
  return `${uid.slice(0, 4)}****${uid.slice(-4)}`;
}

export function isIncidentStatus(value: unknown): value is IncidentStatus {
  return (INCIDENT_STATUSES as readonly string[]).includes(text(value).trim().toLowerCase());
}

export function isIncidentSeverity(value: unknown): value is IncidentSeverity {
  return (INCIDENT_SEVERITIES as readonly string[]).includes(text(value).trim().toLowerCase());
}

export function validIncidentId(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value).trim());
}

export function validIncidentEventId(value: unknown) {
  const normalized = text(value).trim();
  if (!/^[1-9]\d{0,18}$/.test(normalized)) return false;
  try {
    return BigInt(normalized) <= 9_223_372_036_854_775_807n;
  } catch {
    return false;
  }
}

export function validIncidentTenantSlug(value: unknown) {
  return /^[a-z0-9][a-z0-9._-]{0,119}$/.test(text(value).trim().toLowerCase());
}

export function validIncidentIdempotencyKey(value: unknown) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(text(value).trim());
}

export function validIncidentExpectedVersion(value: unknown) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return false;
  const normalized = text(value).trim();
  if (!/^[1-9]\d{0,18}$/.test(normalized)) return false;
  try {
    return BigInt(normalized) <= 9_223_372_036_854_775_807n;
  } catch {
    return false;
  }
}

export function boundedIncidentText(value: unknown, minimum: number, maximum: number) {
  const normalized = text(value).trim();
  if (normalized.length < minimum || normalized.length > maximum) return null;
  return normalized;
}

function incidentFromRow(row: Record<string, unknown>): EventIncident {
  return {
    id: text(row.incident_id || row.id),
    tenantId: text(row.tenant_id),
    tenantSlug: text(row.tenant_slug).toLowerCase(),
    eventId: text(row.event_id),
    ticketId: text(row.ticket_id),
    ticketStatus: nullableText(row.ticket_status),
    status: text(row.status) as IncidentStatus,
    severity: text(row.severity) as IncidentSeverity,
    title: text(row.title),
    summary: text(row.summary),
    openedAt: iso(row.opened_at),
    resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    version: Number(row.version || 1),
    idempotentReplay: Boolean(row.idempotent_replay),
    evidence: {
      result: text(row.event_result),
      verdict: text(row.event_verdict || row.event_result),
      reason: nullableText(row.event_reason),
      riskLevel: text(row.event_risk_level || "unknown"),
      uidMasked: maskIncidentUid(row.uid_hex),
      bid: nullableText(row.bid),
      occurredAt: row.event_created_at ? iso(row.event_created_at) : null,
      city: nullableText(row.city),
      country: nullableText(row.country_code),
      source: text(row.event_source || "unknown"),
    },
  };
}

function historyFromRow(row: Record<string, unknown>): IncidentHistoryEntry {
  return {
    id: text(row.id),
    action: text(row.action) as IncidentHistoryEntry["action"],
    fromStatus: nullableText(row.from_status) as IncidentStatus | null,
    toStatus: text(row.to_status) as IncidentStatus,
    fromSeverity: nullableText(row.from_severity) as IncidentSeverity | null,
    toSeverity: text(row.to_severity) as IncidentSeverity,
    actorId: text(row.actor_id),
    actorEmail: text(row.actor_email),
    actorLabel: text(row.actor_label),
    reason: text(row.reason),
    createdAt: iso(row.created_at),
  };
}

const INCIDENT_SELECT = `
  SELECT
    i.id::text AS incident_id,
    i.tenant_id::text AS tenant_id,
    t.slug AS tenant_slug,
    i.event_id::text AS event_id,
    i.ticket_id::text AS ticket_id,
    tk.status AS ticket_status,
    i.status,
    i.severity,
    i.title,
    i.summary,
    i.opened_at,
    i.resolved_at,
    i.created_at,
    i.updated_at,
    i.version,
    false AS idempotent_replay,
    e.result AS event_result,
    COALESCE(NULLIF(e.verdict, ''), e.result) AS event_verdict,
    e.reason AS event_reason,
    COALESCE(e.risk_level::text, 'unknown') AS event_risk_level,
    e.uid_hex,
    COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
    e.created_at AS event_created_at,
    e.city,
    e.country_code,
    e.source AS event_source
  FROM event_incidents i
  JOIN tenants t ON t.id = i.tenant_id
  JOIN events e ON e.id = i.event_id AND e.created_at = i.event_created_at
  LEFT JOIN batches b ON b.id = e.batch_id
  JOIN tickets tk ON tk.id = i.ticket_id
`;

// The tagged-template driver cannot interpolate SQL fragments. These read
// queries intentionally remain explicit so tenant predicates are visible at
// every database boundary.
export async function listEventIncidents(input: {
  tenantSlug?: string;
  eventId?: string;
  status?: IncidentStatus | "";
  limit?: number;
}, query: IncidentQuery = sql): Promise<EventIncident[]> {
  const tenantSlug = text(input.tenantSlug).trim().toLowerCase();
  const eventId = text(input.eventId).trim();
  const status = text(input.status).trim().toLowerCase();
  const requestedLimit = Number(input.limit ?? 50);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
    : 50;
  const eventIdFilter = eventId || null;
  const rows = await query/*sql*/`
    SELECT
      i.id::text AS incident_id, i.tenant_id::text AS tenant_id, t.slug AS tenant_slug,
      i.event_id::text AS event_id, i.ticket_id::text AS ticket_id, tk.status AS ticket_status,
      i.status, i.severity, i.title, i.summary, i.opened_at, i.resolved_at,
      i.created_at, i.updated_at, i.version, false AS idempotent_replay,
      e.result AS event_result, COALESCE(NULLIF(e.verdict, ''), e.result) AS event_verdict,
      e.reason AS event_reason, COALESCE(e.risk_level::text, 'unknown') AS event_risk_level,
      e.uid_hex, COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
      e.created_at AS event_created_at, e.city, e.country_code, e.source AS event_source
    FROM event_incidents i
    JOIN tenants t ON t.id = i.tenant_id
    JOIN events e ON e.id = i.event_id AND e.created_at = i.event_created_at
    LEFT JOIN batches b ON b.id = e.batch_id
    JOIN tickets tk ON tk.id = i.ticket_id
    WHERE (${tenantSlug} = '' OR t.slug = ${tenantSlug})
      AND (${eventIdFilter}::bigint IS NULL OR i.event_id = ${eventIdFilter}::bigint)
      AND (${status} = '' OR i.status = ${status})
    ORDER BY i.updated_at DESC, i.id DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => incidentFromRow(row as Record<string, unknown>));
}

export async function getEventIncident(input: {
  incidentId: string;
  tenantSlug?: string;
}, query: IncidentQuery = sql): Promise<{ incident: EventIncident; history: IncidentHistoryEntry[] } | null> {
  const tenantSlug = text(input.tenantSlug).trim().toLowerCase();
  const rows = await query/*sql*/`
    SELECT
      i.id::text AS incident_id, i.tenant_id::text AS tenant_id, t.slug AS tenant_slug,
      i.event_id::text AS event_id, i.ticket_id::text AS ticket_id, tk.status AS ticket_status,
      i.status, i.severity, i.title, i.summary, i.opened_at, i.resolved_at,
      i.created_at, i.updated_at, i.version, false AS idempotent_replay,
      e.result AS event_result, COALESCE(NULLIF(e.verdict, ''), e.result) AS event_verdict,
      e.reason AS event_reason, COALESCE(e.risk_level::text, 'unknown') AS event_risk_level,
      e.uid_hex, COALESCE(NULLIF(e.bid, ''), b.bid) AS bid,
      e.created_at AS event_created_at, e.city, e.country_code, e.source AS event_source,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', h.id::text,
          'action', h.action,
          'from_status', h.from_status,
          'to_status', h.to_status,
          'from_severity', h.from_severity,
          'to_severity', h.to_severity,
          'actor_id', h.actor_id::text,
          'actor_email', h.actor_email,
          'actor_label', h.actor_label,
          'reason', h.reason,
          'created_at', h.created_at
        ) ORDER BY h.created_at ASC, h.id ASC)
        FROM event_incident_history h
        WHERE h.incident_id = i.id AND h.tenant_id = i.tenant_id
      ), '[]'::jsonb) AS incident_history
    FROM event_incidents i
    JOIN tenants t ON t.id = i.tenant_id
    JOIN events e ON e.id = i.event_id AND e.created_at = i.event_created_at
    LEFT JOIN batches b ON b.id = e.batch_id
    JOIN tickets tk ON tk.id = i.ticket_id
    WHERE i.id::text = ${input.incidentId}
      AND (${tenantSlug} = '' OR t.slug = ${tenantSlug})
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const rawHistory = (rows[0] as Record<string, unknown>).incident_history;
  const historyRows = Array.isArray(rawHistory) ? rawHistory : [];
  return {
    incident: incidentFromRow(rows[0] as Record<string, unknown>),
    history: historyRows.map((row) => historyFromRow(row as Record<string, unknown>)),
  };
}

async function hydrateWorkflowRow(row: Record<string, unknown>, query: IncidentQuery) {
  const detail = await getEventIncident({
    incidentId: text(row.incident_id),
    tenantSlug: text(row.tenant_slug),
  }, query);
  if (!detail) throw new Error("incident_commit_readback_failed");
  return { ...detail.incident, idempotentReplay: Boolean(row.idempotent_replay) };
}

export async function openEventIncident(input: {
  eventId: string;
  expectedTenantSlug?: string;
  severity: IncidentSeverity;
  title: string;
  summary: string;
  actorId: string;
  actorEmail: string;
  actorLabel: string;
  reason: string;
}, query: IncidentQuery = sql) {
  const rows = await query/*sql*/`
    SELECT * FROM nexid_open_event_incident(
      ${input.eventId}::bigint,
      ${input.expectedTenantSlug || null}::text,
      ${input.severity}::text,
      ${input.title}::text,
      ${input.summary}::text,
      ${input.actorId}::uuid,
      ${input.actorEmail}::text,
      ${input.actorLabel}::text,
      ${input.reason}::text
    )
  `;
  if (!rows[0]) throw new Error("incident_commit_readback_failed");
  return hydrateWorkflowRow(rows[0] as Record<string, unknown>, query);
}

export async function transitionEventIncident(input: {
  incidentId: string;
  expectedTenantSlug?: string;
  expectedVersion: string | number;
  toStatus: IncidentStatus;
  toSeverity?: IncidentSeverity | null;
  actorId: string;
  actorEmail: string;
  actorLabel: string;
  reason: string;
  idempotencyKey: string;
}, query: IncidentQuery = sql) {
  const rows = await query/*sql*/`
    SELECT * FROM nexid_transition_event_incident(
      ${input.incidentId}::uuid,
      ${input.expectedTenantSlug || null}::text,
      ${String(input.expectedVersion)}::bigint,
      ${input.toStatus}::text,
      ${input.toSeverity || null}::text,
      ${input.actorId}::uuid,
      ${input.actorEmail}::text,
      ${input.actorLabel}::text,
      ${input.reason}::text,
      ${input.idempotencyKey}::text
    )
  `;
  if (!rows[0]) throw new Error("incident_commit_readback_failed");
  return hydrateWorkflowRow(rows[0] as Record<string, unknown>, query);
}

export function incidentWorkflowError(error: unknown) {
  const code = text((error as { code?: unknown })?.code);
  const message = error instanceof Error ? error.message : text(error);
  const matches = (reason: string) => message.includes(reason);
  if (matches("incident_tenant_scope_mismatch")) return { status: 403, reason: "incident_tenant_scope_mismatch" };
  if (matches("incident_tenant_scope_required")) return { status: 400, reason: "incident_tenant_scope_required" };
  if (matches("incident_event_tenant_conflict")) return { status: 409, reason: "incident_event_tenant_conflict" };
  if (matches("incident_event_identity_ambiguous")) return { status: 409, reason: "incident_event_identity_ambiguous" };
  if (matches("incident_tenant_link_broken")) return { status: 409, reason: "incident_tenant_link_broken" };
  if (matches("incident_event_already_open_conflict")) return { status: 409, reason: "incident_event_already_open_conflict" };
  if (matches("incident_idempotency_key_conflict")) return { status: 409, reason: "incident_idempotency_key_conflict" };
  if (matches("incident_stale_version")) return { status: 409, reason: "stale_version" };
  if (matches("incident_event_not_found")) return { status: 404, reason: "incident_event_not_found" };
  if (matches("incident_not_found")) return { status: 404, reason: "incident_not_found" };
  if (matches("incident_transition_invalid")) return { status: 409, reason: "incident_transition_invalid" };
  if (matches("incident_transition_no_change")) return { status: 409, reason: "incident_transition_no_change" };
  if (matches("incident_ticket_link_broken")) return { status: 409, reason: "incident_ticket_link_broken" };
  if (code === "42P01" || code === "42883" || matches("event_incidents") || matches("nexid_open_event_incident") || matches("nexid_transition_event_incident")) {
    return { status: 503, reason: "incident_schema_migration_required" };
  }
  return { status: 503, reason: "incident_workflow_unavailable" };
}

// Exported only for focused contract tests; routes use the explicit query
// functions above so no caller can inject a SQL fragment.
export const incidentWorkflowContract = { selectShape: INCIDENT_SELECT };
