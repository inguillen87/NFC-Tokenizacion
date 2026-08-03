export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { json } from "../../../../lib/http";
import { requireShareToken } from "../../../../lib/public-cta-auth";
import { resolvePublicCtaTarget } from "../../../../lib/public-cta-target";
import {
  isPublicExperienceContextBlocked,
  isPublicClientExperienceEvent,
  isSensitivePublicExperienceEvent,
  loadPublicExperienceContext,
  normalizePublicExperienceEventType,
  normalizePublicExperienceIdempotencyKey,
  recordPublicExperienceEvent,
  sanitizePublicExperienceData,
} from "../../../../lib/public-experience-events";

const MAX_EXPERIENCE_BODY_BYTES = 8 * 1024;

function traceId(req: Request) {
  const supplied = String(req.headers.get("x-nexid-trace-id") || "").trim();
  return /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,159}$/.test(supplied)
    ? supplied
    : `experience_${crypto.randomUUID()}`;
}

export async function POST(req: Request) {
  const trace = traceId(req);
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "proof_write",
    tenantId: "platform",
    subjectId: "experience-event:public",
  });
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_EXPERIENCE_BODY_BYTES);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json", trace_id: trace }, tooLarge ? 413 : 400, { "cache-control": "no-store" });
  }

  const eventType = normalizePublicExperienceEventType(body.event_type ?? body.eventType);
  const idempotencyKey = normalizePublicExperienceIdempotencyKey(
    req.headers.get("idempotency-key") || body.idempotency_key || body.idempotencyKey,
  );
  if (!eventType) return json({ ok: false, reason: "experience_event_type_invalid", trace_id: trace }, 400, { "cache-control": "no-store" });
  if (!isPublicClientExperienceEvent(eventType)) {
    return json({ ok: false, reason: "experience_event_requires_authoritative_workflow", trace_id: trace }, 409, { "cache-control": "no-store" });
  }
  if (!idempotencyKey) return json({ ok: false, reason: "idempotency_key_invalid", trace_id: trace }, 400, { "cache-control": "no-store" });

  const target = await resolvePublicCtaTarget(body);
  if (!target.ok) return json({ ok: false, reason: target.reason, trace_id: trace }, target.status, { "cache-control": "no-store" });
  if (target.source !== "event" || !target.eventId || !target.tenantId || !target.batchId) {
    return json({ ok: false, reason: "event_scope_required", trace_id: trace }, 409, { "cache-control": "no-store" });
  }

  const auth = requireShareToken(req, target.bid, target.shareUid);
  if (!auth.ok) {
    return json({ ok: false, reason: auth.reason, share_token_status: auth.share_token_status, trace_id: trace }, 401, { "cache-control": "no-store" });
  }

  const context = await loadPublicExperienceContext(target.eventId, target.tenantId).catch(() => null);
  if (!context || context.batchId !== target.batchId || context.bid !== target.bid) {
    return json({ ok: false, reason: "experience_event_context_unavailable", trace_id: trace }, 409, { "cache-control": "no-store" });
  }
  if (isSensitivePublicExperienceEvent(eventType) && isPublicExperienceContextBlocked(context)) {
    return json({
      ok: false,
      reason: "sensitive_action_blocked_by_trust_state",
      event_type: eventType,
      trace_id: trace,
    }, 409, { "cache-control": "no-store" });
  }

  try {
    const saved = await recordPublicExperienceEvent({
      context,
      eventType,
      idempotencyKey,
      data: sanitizePublicExperienceData(body.data),
      traceId: trace,
    });
    return json({
      ok: true,
      event_type: eventType,
      event: { id: saved.id, recorded_at: saved.createdAt },
      replayed: saved.replayed,
      trace_id: trace,
    }, saved.replayed ? 200 : 201, { "cache-control": "no-store" });
  } catch (error) {
    const code = String((error as { code?: unknown })?.code || "");
    const message = error instanceof Error ? error.message : "";
    if (message === "public_experience_event_idempotency_conflict") {
      return json({ ok: false, reason: "idempotency_key_conflict", trace_id: trace }, 409, { "cache-control": "no-store" });
    }
    if (code === "40001") {
      return json({ ok: false, reason: "experience_event_retry_required", trace_id: trace }, 409, {
        "cache-control": "no-store",
        "retry-after": "1",
      });
    }
    return json({ ok: false, reason: "experience_event_write_unavailable", trace_id: trace }, 503, {
      "cache-control": "no-store",
      "retry-after": "5",
    });
  }
}
