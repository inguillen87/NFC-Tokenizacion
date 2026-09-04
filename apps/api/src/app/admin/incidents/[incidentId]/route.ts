export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  checkAdminWithPermission,
  getAdminPrincipal,
} from "../../../../lib/auth";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { json } from "../../../../lib/http";
import {
  boundedIncidentText,
  getEventIncident,
  incidentWorkflowError,
  isIncidentSeverity,
  isIncidentStatus,
  transitionEventIncident,
  validIncidentId,
  validIncidentIdempotencyKey,
  validIncidentExpectedVersion,
  validIncidentTenantSlug,
} from "../../../../lib/incident-workflow";
import { publishRealtimeEvent } from "../../../../lib/realtime-events";

const MAX_INCIDENT_TRANSITION_BODY_BYTES = 8 * 1024;

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

export async function GET(req: Request, context: { params: Promise<{ incidentId: string }> }) {
  const auth = await checkAdminWithPermission(req, "incidents:read");
  if (auth) return auth;

  const { incidentId: encodedId } = await context.params;
  const incidentId = decodeURIComponent(encodedId || "").trim();
  if (!validIncidentId(incidentId)) return json({ ok: false, reason: "incident_id_invalid" }, 400);
  const scope = requestedTenant(req);
  if (scope.error) return scope.error;

  try {
    const detail = await getEventIncident({ incidentId, tenantSlug: scope.tenantSlug });
    if (!detail) return json({ ok: false, reason: "incident_not_found" }, 404);
    return json({ ok: true, ...detail }, 200, { "cache-control": "no-store" });
  } catch (error) {
    const safe = incidentWorkflowError(error);
    return json({ ok: false, reason: safe.reason }, safe.status, { "cache-control": "no-store" });
  }
}

export async function POST(req: Request, context: { params: Promise<{ incidentId: string }> }) {
  const auth = await checkAdminWithPermission(req, "incidents:write");
  if (auth) return auth;

  const { incidentId: encodedId } = await context.params;
  const incidentId = decodeURIComponent(encodedId || "").trim();
  if (!validIncidentId(incidentId)) return json({ ok: false, reason: "incident_id_invalid" }, 400);

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_INCIDENT_TRANSITION_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const scope = requestedTenant(req, body.tenantSlug ?? body.tenant_slug ?? body.tenant);
  if (scope.error) return scope.error;
  if (!scope.tenantSlug) return json({ ok: false, reason: "incident_tenant_scope_required" }, 400);
  const toStatus = String(body.status ?? body.toStatus ?? body.to_status ?? "").trim().toLowerCase();
  const rawSeverity = String(body.severity ?? body.toSeverity ?? body.to_severity ?? "").trim().toLowerCase();
  const reason = boundedIncidentText(body.reason, 3, 2000);
  const idempotencyKey = String(req.headers.get("idempotency-key") || body.idempotencyKey || body.idempotency_key || "").trim();
  const rawExpectedVersion = body.expectedVersion ?? body.expected_version;
  const expectedVersion = String(rawExpectedVersion ?? "").trim();
  if (!isIncidentStatus(toStatus)) return json({ ok: false, reason: "incident_status_invalid" }, 400);
  if (rawSeverity && !isIncidentSeverity(rawSeverity)) return json({ ok: false, reason: "incident_severity_invalid" }, 400);
  const toSeverity = rawSeverity && isIncidentSeverity(rawSeverity) ? rawSeverity : null;
  if (!reason) return json({ ok: false, reason: "incident_reason_invalid" }, 400);
  if (!validIncidentIdempotencyKey(idempotencyKey)) return json({ ok: false, reason: "idempotency_key_required" }, 400);
  if (!expectedVersion) return json({ ok: false, reason: "incident_expected_version_required" }, 400);
  if (!validIncidentExpectedVersion(expectedVersion)) return json({ ok: false, reason: "incident_expected_version_invalid" }, 400);

  const principal = getAdminPrincipal(req);
  const actorEmail = boundedIncidentText(principal.email, 3, 320);
  const actorLabel = boundedIncidentText(principal.label || principal.email, 1, 160);
  if (!actorEmail || !actorLabel) return json({ ok: false, reason: "incident_actor_identity_invalid" }, 503);
  try {
    const incident = await transitionEventIncident({
      incidentId,
      expectedTenantSlug: scope.tenantSlug,
      expectedVersion,
      toStatus,
      toSeverity,
      actorId: principal.userId,
      actorEmail,
      actorLabel,
      reason,
      idempotencyKey,
    });
    await publishRealtimeEvent({
      event_type: "incident.updated",
      incident_id: incident.id,
      tenant_id: incident.tenantId,
      tenant_slug: incident.tenantSlug,
      ticket_id: incident.ticketId,
      incident_event_id: incident.eventId,
      incident_status: incident.status,
      incident_severity: incident.severity,
      source: incident.evidence.source,
      created_at: incident.updatedAt,
    });
    return json({ ok: true, incident }, 200, { "cache-control": "no-store" });
  } catch (error) {
    const safe = incidentWorkflowError(error);
    return json({ ok: false, reason: safe.reason }, safe.status, { "cache-control": "no-store" });
  }
}
