export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminPrincipal } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { ensureOrderRequestsSchema } from "../../../lib/commercial-runtime-schema";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import {
  deriveAdminOrderRequestId,
  normalizeAdminIdempotencyKey,
  resolveAdminWriteTenant,
  tenantReference,
} from "../../../lib/admin-commercial-policy";
import { logAuditEvent } from "../../../lib/audit-logger";
import { getRequestMeta } from "../../../lib/request-meta";

function text(value: unknown, maximum: number) {
  return String(value || "").trim().slice(0, maximum);
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin"]);
  if (auth) return auth;
  await ensureOrderRequestsSchema();
  const rows = await sql/*sql*/`SELECT * FROM order_requests ORDER BY created_at DESC LIMIT 300`;
  return json(rows);
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 16 * 1024);
  } catch (error) {
    const tooLarge = error instanceof RequestBodyTooLargeError;
    return json({ ok: false, reason: tooLarge ? "request_body_too_large" : "invalid_json" }, tooLarge ? 413 : 400);
  }

  const tenantResult = await resolveAdminWriteTenant({
    principal,
    references: [
      { tenantId: body.tenantId },
      { tenantId: body.tenant_id },
      { tenantSlug: body.tenantSlug },
      { tenantSlug: body.tenant_slug },
      tenantReference(body.tenant),
      tenantReference(new URL(req.url).searchParams.get("tenant")),
    ],
    lookup: async ({ tenantId, tenantSlug }) => (await sql/*sql*/`
      SELECT id::text AS id, lower(slug) AS slug
      FROM tenants
      WHERE (${tenantId} = '' OR id::text = ${tenantId})
        AND (${tenantSlug} = '' OR lower(slug) = ${tenantSlug})
      LIMIT 2
    `) as Array<{ id: unknown; slug: unknown }>,
  });
  if (!tenantResult.ok) return json({ ok: false, reason: tenantResult.reason }, tenantResult.status);
  const { tenantId } = tenantResult.tenant;

  const idempotencyKey = normalizeAdminIdempotencyKey(
    req.headers.get("idempotency-key") || body.idempotencyKey || body.idempotency_key,
  );
  if (!idempotencyKey) return json({ ok: false, reason: "idempotency_key_required" }, 400);

  const locale = text(body.locale, 16) || "es-AR";
  const contact = text(body.contact, 320);
  const company = text(body.company, 200);
  const tagType = text(body.tag_type || body.tagType, 80) || "basic";
  const rawVolume = Number(body.volume || 0);
  if (!Number.isFinite(rawVolume) || rawVolume <= 0 || rawVolume > 10_000_000) {
    return json({ ok: false, reason: "volume_invalid" }, 400);
  }
  const volume = Math.trunc(rawVolume);
  const notes = text(body.notes, 4_000);
  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  await ensureOrderRequestsSchema();
  const orderId = deriveAdminOrderRequestId(tenantId, idempotencyKey);
  const insertedRows = await sql/*sql*/`
    INSERT INTO order_requests (id, tenant_id, locale, contact, company, tag_type, volume, notes, status, source)
    VALUES (${orderId}::uuid, ${tenantId}::uuid, ${locale}, ${contact}, ${company}, ${tagType}, ${volume}, ${notes}, 'new', 'admin')
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;
  const created = Boolean(insertedRows[0]);
  const rows = created
    ? insertedRows
    : await sql/*sql*/`SELECT * FROM order_requests WHERE id = ${orderId}::uuid LIMIT 1`;
  const order = rows[0] as Record<string, unknown> | undefined;
  if (!order) return json({ ok: false, reason: "idempotency_replay_unavailable" }, 503);

  const sameRequest = String(order.tenant_id || "").toLowerCase() === tenantId
    && String(order.locale || "") === locale
    && String(order.contact || "") === contact
    && String(order.company || "") === company
    && String(order.tag_type || "") === tagType
    && Number(order.volume || 0) === volume
    && String(order.notes || "") === notes
    && String(order.source || "") === "admin";
  if (!sameRequest) return json({ ok: false, reason: "idempotency_key_conflict" }, 409);

  let warning: string | null = null;
  if (created) {
    const requestMeta = getRequestMeta(req);
    const audit = await logAuditEvent({
      actorId: principal.userId,
      tenantId,
      action: "admin_order_request_created",
      resourceType: "order_request",
      resourceId: String(order.id || orderId),
      afterData: { status: "new", tag_type: tagType, volume, source: "admin" },
      ipAddress: requestMeta.ip,
      userAgent: requestMeta.userAgent,
      requestId: requestMeta.traceId,
    });
    warning = audit.ok ? null : audit.reason;
  }

  return json({ ...order, ok: true, idempotent_replay: !created, warning }, created ? 201 : 200);
}
