import { json } from "../../../../lib/http";
import { recordDemoCta } from "../../../../lib/demo-cta";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

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

  const saved = await recordDemoCta("problem_report_request", bid, uid, {
    request_status: "pending_review",
    provenance: "demo_cta_action_log",
    event_id: target.eventId,
    tenant_id: target.tenantId,
    category: text(body.category || body.reason || "tap_review", 80),
    description: text(body.description || body.message || body.notes, 1_500) || null,
    contact_provided: Boolean(text(body.contact || body.email || body.phone || body.whatsapp, 320)),
    reported_at: new Date().toISOString(),
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  });

  return json({
    ok: true,
    action: "report_problem",
    request_status: "pending_review",
    outcome: "request_recorded",
    ticket_created: false,
    ticket: null,
    request: { id: saved.id, recorded_at: saved.created_at },
    provenance: { mode: "demo_action_log", system: "demo_cta_actions", real_ticket_service: false },
    trace_id: traceId,
    share_token_status: auth.share_token_status,
  }, 202);
}
