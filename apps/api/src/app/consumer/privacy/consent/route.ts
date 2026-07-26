export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../../lib/consumer-auth";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../../lib/commercial-runtime-schema";
import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../../lib/bounded-request-body";

export async function PATCH(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const limited = await enforceCriticalRateLimit(req, { rateClass: "public_write", tenantId: "consumer", subjectId: `consumer:${consumer.id}:privacy-consent` });
  if (limited) return limited;
  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 8 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, error: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }
  await ensureConsumerPortalSchema();
  if (!body.tenantId || !body.scope) return json({ ok: false, error: "tenantId_scope_required" }, 400);
  const granted = Boolean(body.granted);
  const rows = await sql/*sql*/`
    INSERT INTO consumer_tenant_consents (tenant_id, consumer_id, scope, granted, granted_at, revoked_at, source)
    VALUES (${body.tenantId}, ${consumer.id}, ${body.scope}, ${granted}, ${granted ? new Date().toISOString() : null}, ${granted ? null : new Date().toISOString()}, 'consumer_privacy')
    ON CONFLICT (tenant_id, consumer_id, scope)
    DO UPDATE SET granted = EXCLUDED.granted, granted_at = EXCLUDED.granted_at, revoked_at = EXCLUDED.revoked_at
    RETURNING *
  `;
  return json({ ok: true, consent: rows[0] });
}
