export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomUUID } from "node:crypto";

import { auditFreeformContainsSecret } from "../../../../../lib/audit-freeform-secret-policy";
import { checkAdmin, getAdminActor, getAdminPrincipal } from "../../../../../lib/auth";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "../../../../../lib/bounded-request-body";
import { ensureSdkSchema } from "../../../../../lib/commercial-runtime-schema";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../../../lib/critical-rate-limit";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import {
  resolveWebhookTenant,
  WEBHOOK_ADMIN_BODY_MAX_BYTES,
  webhookAuditRequestMeta,
} from "../../../../../lib/webhook-lifecycle";
import { checkWebhookPermission } from "../../../webhooks/policy";

const NO_STORE = { "cache-control": "no-store" };
const DELIVERY_ID = /^[1-9][0-9]{0,18}$/;
const BODY_FIELDS = new Set(["reason", "tenant"]);

function replayFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("webhook_delivery_not_found")) return { status: 404, reason: "webhook_delivery_not_found" };
  if (message.includes("webhook_delivery_not_replayable")) return { status: 409, reason: "webhook_delivery_not_replayable" };
  if (message.includes("webhook_delivery_destination_not_current")) return { status: 409, reason: "webhook_delivery_destination_not_current" };
  if (message.includes("webhook_delivery_replay_actor_denied")) return { status: 403, reason: "webhook_delivery_replay_actor_denied" };
  if (message.includes("webhook_delivery_replay_input_invalid")) return { status: 400, reason: "webhook_delivery_replay_input_invalid" };
  const code = String((error as { code?: unknown })?.code || "");
  if (["42P01", "42703", "42883"].includes(code)) {
    return {
      status: 503,
      reason: "webhook_delivery_replay_schema_required",
      requiredMigration: "20260802230000_0088_enterprise_event_profile.sql",
    };
  }
  return { status: 503, reason: "webhook_delivery_replay_unavailable" };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "write");
  if (permission) return permission;
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "webhook",
    ...adminCriticalRateLimitIdentity(req),
    tenantWide: true,
  });
  if (rateLimited) return rateLimited;

  const principal = getAdminPrincipal(req);
  if (!principal.mfaVerified) {
    return json({ ok: false, reason: "webhook_delivery_replay_mfa_required" }, 403, NO_STORE);
  }
  const { id } = await context.params;
  if (!DELIVERY_ID.test(id)) return json({ ok: false, reason: "webhook_delivery_not_found" }, 404, NO_STORE);

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJsonBody<unknown>(req, WEBHOOK_ADMIN_BODY_MAX_BYTES);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new SyntaxError("invalid_json_body");
    body = parsed as Record<string, unknown>;
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json_body" }, tooLarge ? 413 : 400, NO_STORE);
  }
  const invalidFields = Object.keys(body).filter((field) => !BODY_FIELDS.has(field));
  if (invalidFields.length) {
    return json({ ok: false, reason: "webhook_delivery_replay_fields_invalid", invalidFields }, 400, NO_STORE);
  }
  const reason = String(body.reason || "").trim();
  if (reason.length < 10 || reason.length > 500 || auditFreeformContainsSecret(reason)) {
    return json({ ok: false, reason: "webhook_delivery_replay_reason_invalid" }, 400, NO_STORE);
  }
  const idempotencyKey = String(req.headers.get("idempotency-key") || "").trim();
  if (idempotencyKey.length < 8 || idempotencyKey.length > 255 || /[\u0000-\u001f\u007f]/.test(idempotencyKey)) {
    return json({ ok: false, reason: "idempotency_key_required" }, 400, NO_STORE);
  }

  const tenant = await resolveWebhookTenant(principal, body.tenant);
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404, NO_STORE);
  const actor = getAdminActor(req);
  const meta = webhookAuditRequestMeta(req);

  try {
    await ensureSdkSchema();
    const rows = await sql/*sql*/`
      SELECT * FROM public.nexid_replay_webhook_delivery_v1(${JSON.stringify({
        operation_id: randomUUID(),
        delivery_id: id,
        tenant_id: tenant.id,
        actor_id: actor.id,
        idempotency_key: idempotencyKey,
        reason,
        request_id: meta.requestId,
        ip_address: meta.ipAddress,
        user_agent: meta.userAgent,
      })}::jsonb)
    `;
    if (!rows[0]) return json({ ok: false, reason: "webhook_delivery_not_found" }, 404, NO_STORE);
    return json({
      ok: true,
      tenant: { slug: tenant.slug, name: tenant.name },
      replay: rows[0],
    }, rows[0].idempotent_replay ? 200 : 202, NO_STORE);
  } catch (error) {
    const failure = replayFailure(error);
    return json({
      ok: false,
      reason: failure.reason,
      ...("requiredMigration" in failure ? { requiredMigration: failure.requiredMigration } : {}),
    }, failure.status, { ...NO_STORE, ...(failure.status === 503 ? { "retry-after": "1" } : {}) });
  }
}
