import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { sql } from "../../../../lib/db";
import { ensureTicketsSchema } from "../../../../lib/commercial-runtime-schema";
import { publishRealtimeEvent } from "../../../../lib/realtime-events";

const MAX_REPORT_BODY_BYTES = 32 * 1024;

function text(value: unknown, maximum: number) {
  return String(value || "").trim().slice(0, maximum);
}

export async function POST(req: Request) {
  const traceId = req.headers.get("x-nexid-trace-id") || `api_cta_${Date.now().toString(36)}`;
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "report-problem:public",
  });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_REPORT_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json", trace_id: traceId }, tooLarge ? 413 : 400);
  }
  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: traceId }, target.status);
  const { bid, uid } = target;

  const auth = requireShareToken(req, bid, target.shareUid);
  if (!auth.ok) return json({ ok: false, reason: auth.reason, trace_id: traceId, share_token_status: auth.share_token_status }, 401);

  const category = text(body.category || body.reason || "tap_review", 80);
  const description = text(body.description || body.message || body.notes, 1_500) || null;
  const contact = text(body.contact || body.email || body.phone || body.whatsapp, 320) || "anonymous-sun-report";
  let ticket: Record<string, unknown> | undefined;
  try {
    await ensureTicketsSchema();
    const rows = await sql/*sql*/`
      INSERT INTO tickets (tenant_id, bid, uid_hex, tap_event_id, category, locale, contact, title, detail, status, source)
      VALUES (
        ${target.tenantId || null}::uuid,
        ${bid},
        ${uid ? uid.toUpperCase() : null},
        ${target.eventId ? String(target.eventId) : null}::bigint,
        ${category},
        'es-AR',
        ${contact},
        ${`Revisión de etiqueta digital · ${bid}`},
        ${JSON.stringify({
          bid,
          uid_masked: uid ? `${uid.slice(0, 4)}***${uid.slice(-4)}` : null,
          event_id: target.eventId,
          tenant_id: target.tenantId,
          category,
          description,
          reported_at: new Date().toISOString(),
          share_token_status: auth.share_token_status,
        })},
        'open',
        'sun_public_report'
      )
      RETURNING id, tenant_id, status, created_at
    `;
    ticket = rows[0];
  } catch (error) {
    console.error("[public_cta_report] ticket persistence failed", { traceId, error });
    return json({ ok: false, reason: "ticket_persistence_unavailable", trace_id: traceId }, 503);
  }

  let saved: Record<string, unknown> | null = null;
  try {
    saved = await recordDemoCta("problem_report_request", bid, uid, {
    request_status: "pending_review",
    provenance: "demo_cta_action_log",
    event_id: target.eventId,
    tenant_id: target.tenantId,
    category,
    description,
    contact_provided: contact !== "anonymous-sun-report",
    ticket_id: ticket?.id || null,
    reported_at: new Date().toISOString(),
    trace_id: traceId,
    share_token_status: auth.share_token_status,
    });
  } catch (error) {
    console.warn("[public_cta_report] companion action log failed", { traceId, error });
  }

  publishRealtimeEvent({
    event_type: "ticket.created",
    ticket_id: String(ticket?.id || ""),
    tenant_id: target.tenantId || undefined,
    contact,
    source: "sun_public_report",
    status: String(ticket?.status || "open"),
    created_at: String(ticket?.created_at || new Date().toISOString()),
  });

  return json({
    ok: true,
    action: "report_problem",
    request_status: "open",
    outcome: "ticket_created",
    ticket_created: true,
    ticket: {
      id: ticket?.id,
      status: ticket?.status || "open",
      created_at: ticket?.created_at,
      tenant_assigned: Boolean(ticket?.tenant_id),
    },
    request: saved ? { id: saved.id, recorded_at: saved.created_at } : null,
    provenance: { mode: "ticket", system: "tickets", real_ticket_service: true },
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  }, 201);
}
