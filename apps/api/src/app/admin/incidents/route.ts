export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdminWithPermission,
  getAdminPrincipal,
} from "../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { json } from "../../../lib/http";
import {
  boundedIncidentText,
  incidentWorkflowError,
  isIncidentSeverity,
  isIncidentStatus,
  listEventIncidents,
  openEventIncident,
  validIncidentEventId,
  validIncidentTenantSlug,
} from "../../../lib/incident-workflow";
import { publishRealtimeEvent } from "../../../lib/realtime-events";

const MAX_INCIDENT_BODY_BYTES = 16 * 1024;

function requestedTenant(req: Request, inputTenant?: unknown) {
  const principal = getAdminPrincipal(req);
  const urlTenant = new URL(req.url).searchParams.get("tenant");
  const requested = String(inputTenant ?? urlTenant ?? "").trim().toLowerCase();
  if (principal.tenantSlug && requested && requested !== principal.tenantSlug) {
    return { error: json({ ok: false, reason: "incident_tenant_scope_mismatch" }, 403), tenantSlug: "" };
  }
  if (requested && !validIncidentTenantSlug(requested)) {
    return { error: json({ ok: false, reason: "incident_tenant_scope_invalid" }, 400), tenantSlug: "" };
  }
  return { error: null, tenantSlug: principal.tenantSlug || requested };
}

function publishIncident(incident: Awaited<ReturnType<typeof openEventIncident>>, eventType: "incident.created" | "incident.updated") {
  publishRealtimeEvent({
    event_type: eventType,
    incident_id: incident.id,
    tenant_id: incident.tenantId,
    tenant_slug: incident.tenantSlug,
    ticket_id: incident.ticketId,
    incident_event_id: incident.eventId,
    incident_status: incident.status,
    incident_severity: incident.severity,
    incident_title: incident.title,
    source: incident.evidence.source,
    created_at: incident.updatedAt,
  });
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "incidents:read");
  if (auth) return auth;

  const scope = requestedTenant(req);
  if (scope.error) return scope.error;
  const search = new URL(req.url).searchParams;
  const eventId = String(search.get("eventId") || search.get("event_id") || "").trim();
  const rawStatus = String(search.get("status") || "").trim().toLowerCase();
  if (eventId && !validIncidentEventId(eventId)) return json({ ok: false, reason: "incident_event_id_invalid" }, 400);
  if (rawStatus && !isIncidentStatus(rawStatus)) return json({ ok: false, reason: "incident_status_invalid" }, 400);
  const status = rawStatus && isIncidentStatus(rawStatus) ? rawStatus : "";
  const rawLimit = Number(search.get("limit") || 50);
  if (!Number.isFinite(rawLimit)) return json({ ok: false, reason: "incident_limit_invalid" }, 400);

  try {
    const incidents = await listEventIncidents({
      tenantSlug: scope.tenantSlug,
      eventId,
      status,
      limit: rawLimit,
    });
    return json({
      ok: true,
      scope: { tenant: scope.tenantSlug || "global" },
      count: incidents.length,
      incidents,
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    if (process.env.NODE_ENV === "test" && process.env.VERCEL_ENV === "test") {
      console.warn("[incident_workflow_test_failure]", JSON.stringify({
        code: String((error as { code?: unknown })?.code || "incident_workflow_failed").slice(0, 32),
        diagnostic: String(error instanceof Error ? error.message : "incident_workflow_failed")
          .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted_database_url]")
          .slice(0, 240),
      }));
    }
    const safe = incidentWorkflowError(error);
    return json({ ok: false, reason: safe.reason }, safe.status, { "cache-control": "no-store" });
  }
}

export async function POST(req: Request) {
  const auth = await checkAdminWithPermission(req, "incidents:write");
  if (auth) return auth;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_INCIDENT_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const scope = requestedTenant(req, body.tenantSlug ?? body.tenant_slug ?? body.tenant);
  if (scope.error) return scope.error;
  if (!scope.tenantSlug) return json({ ok: false, reason: "incident_tenant_scope_required" }, 400);
  const eventId = String(body.eventId ?? body.event_id ?? "").trim();
  const severity = String(body.severity || "").trim().toLowerCase();
  const title = boundedIncidentText(body.title, 3, 160);
  const summary = boundedIncidentText(body.summary, 3, 4000);
  const reason = boundedIncidentText(body.reason, 3, 2000);
  if (!validIncidentEventId(eventId)) return json({ ok: false, reason: "incident_event_id_invalid" }, 400);
  if (!isIncidentSeverity(severity)) return json({ ok: false, reason: "incident_severity_invalid" }, 400);
  if (!title) return json({ ok: false, reason: "incident_title_invalid" }, 400);
  if (!summary) return json({ ok: false, reason: "incident_summary_invalid" }, 400);
  if (!reason) return json({ ok: false, reason: "incident_reason_invalid" }, 400);

  const principal = getAdminPrincipal(req);
  const actorEmail = boundedIncidentText(principal.email, 3, 320);
  const actorLabel = boundedIncidentText(principal.label || principal.email, 1, 160);
  if (!actorEmail || !actorLabel) return json({ ok: false, reason: "incident_actor_identity_invalid" }, 503);
  try {
    const incident = await openEventIncident({
      eventId,
      expectedTenantSlug: scope.tenantSlug,
      severity,
      title,
      summary,
      actorId: principal.userId,
      actorEmail,
      actorLabel,
      reason,
    });
    publishIncident(incident, "incident.created");
    return json({ ok: true, incident }, incident.idempotentReplay ? 200 : 201, { "cache-control": "no-store" });
  } catch (error) {
    if (process.env.NODE_ENV === "test" && process.env.VERCEL_ENV === "test") {
      console.warn("[incident_workflow_test_failure]", JSON.stringify({
        code: String((error as { code?: unknown })?.code || "incident_workflow_failed").slice(0, 32),
        diagnostic: String(error instanceof Error ? error.message : "incident_workflow_failed")
          .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted_database_url]")
          .slice(0, 240),
      }));
    }
    const safe = incidentWorkflowError(error);
    return json({ ok: false, reason: safe.reason }, safe.status, { "cache-control": "no-store" });
  }
}
