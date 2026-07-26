export const runtime = "nodejs";

import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { auditAuthEvent } from "../../../lib/iam";
import { getRequestMeta } from "../../../lib/request-meta";

export async function POST(req: Request) {
  const limited = await enforceCriticalRateLimit(req, { rateClass: "auth", tenantId: "platform", subjectId: "admin-forgot-password:unauthenticated" });
  if (limited) return limited;
  let body: { email?: unknown };
  try {
    body = await readBoundedJsonBody<{ email?: unknown }>(req, 4 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400, { "cache-control": "no-store" });
  }
  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, reason: "valid_email_required" }, 400, { "cache-control": "no-store" });
  const meta = getRequestMeta(req);
  await auditAuthEvent(sql as any, {
    email,
    eventName: "password_reset_requested",
    ok: false,
    ...meta,
    meta: { reason: "delivery_not_configured", token_created: false },
  }).catch(() => null);
  return json({
    ok: false,
    reason: "password_reset_delivery_unavailable",
    delivery_state: "not_configured",
    token_created: false,
  }, 503, { "cache-control": "no-store", "retry-after": "3600" });
}
