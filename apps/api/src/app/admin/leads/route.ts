export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission, getAdminPrincipal, getAdminTenantAccess } from "../../../lib/auth";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { publishRealtimeEvent } from "../../../lib/realtime-events";
import { ensureLeadsSchema } from "../../../lib/commercial-runtime-schema";
import { RequestBodyTooLargeError, readBoundedJsonBody } from "../../../lib/bounded-request-body";
import { adminCriticalRateLimitIdentity, enforceCriticalRateLimit } from "../../../lib/critical-rate-limit";
import { resolveAdminWriteTenant, tenantReference } from "../../../lib/admin-commercial-policy";
import { logAuditEvent } from "../../../lib/audit-logger";
import { getRequestMeta } from "../../../lib/request-meta";

function clean(value: unknown, maximum = 320) {
  return String(value || "").trim().slice(0, maximum);
}

function isMissingRelation(error: unknown) {
  const code = String((error as { code?: unknown })?.code || "");
  const message = String((error as Error)?.message || "");
  return code === "42P01" || message.includes("does not exist") || message.includes("relation ");
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "leads.manage");
  if (auth) return auth;
  const { searchParams } = new URL(req.url);
  const requestedTenant = clean(searchParams.get("tenant"));
  const { effectiveTenantSlug: tenant } = getAdminTenantAccess(req, requestedTenant);
  await ensureLeadsSchema();
  let rows;
  try {
    rows = await sql/*sql*/`
      SELECT l.*, tn.slug AS tenant_slug, tn.name AS tenant_name
      FROM leads l
      LEFT JOIN tenants tn ON tn.id = l.tenant_id
      WHERE (${tenant} = '' OR tn.slug = ${tenant})
      ORDER BY l.created_at DESC
      LIMIT 500
    `;
  } catch (error) {
    if (!isMissingRelation(error)) throw error;
    await ensureLeadsSchema();
    rows = await sql/*sql*/`
      SELECT l.*, tn.slug AS tenant_slug, tn.name AS tenant_name
      FROM leads l
      LEFT JOIN tenants tn ON tn.id = l.tenant_id
      WHERE (${tenant} = '' OR tn.slug = ${tenant})
      ORDER BY l.created_at DESC
      LIMIT 500
    `;
  }
  return json(rows);
}

export async function POST(req: Request) {
  const auth = await checkAdminWithPermission(req, "leads.manage");
  if (auth) return auth;
  const principal = getAdminPrincipal(req);
  const rateLimited = await enforceCriticalRateLimit(req, {
    rateClass: "public_write",
    ...adminCriticalRateLimitIdentity(req),
  });
  if (rateLimited) return rateLimited;

  let body: Record<string, unknown>;
  try {
    body = await readBoundedJsonBody<Record<string, unknown>>(req, 32 * 1024);
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
  const { tenantId, tenantSlug } = tenantResult.tenant;

  const locale = clean(body.locale, 16) || "es-AR";
  const name = clean(body.name, 160);
  const email = clean(body.email, 320);
  const phone = clean(body.phone || body.whatsapp, 32);
  const company = clean(body.company, 200);
  const country = clean(body.country, 80);
  const vertical = clean(body.vertical, 80) || "other";
  const roleInterest = clean(body.role_interest || body.role, 120);
  const estimatedVolume = clean(body.estimated_volume || body.volume, 80);
  const rawVolume = Number(body.volume || 0);
  if (!Number.isFinite(rawVolume) || rawVolume < 0 || rawVolume > 10_000_000) {
    return json({ ok: false, reason: "volume_invalid" }, 400);
  }
  const volume = Math.trunc(rawVolume);
  const source = clean(body.source, 80) || "admin";
  const message = clean(body.message, 4_000);
  const eventId = clean(body.eventId || body.event_id, 160);
  const bid = clean(body.bid, 160);
  const uidHex = clean(body.uidHex || body.uid_hex, 32);
  const productName = clean(body.productName || body.product_name, 240);
  const gender = clean(body.gender, 80);
  const occasion = clean(body.occasion, 160);
  const contact = (clean(body.contact) || [email, phone, name].filter(Boolean).join(" | ")).slice(0, 320);
  const tagType = clean(body.tag_type, 80) || (vertical === "events" ? "basic" : "secure");
  const bodyMeta = body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
    ? body.meta as Record<string, unknown>
    : {};
  const meta = {
    ...bodyMeta,
    tenantId,
    tenantSlug,
    eventId: eventId || bodyMeta.eventId || null,
    bid: bid || bodyMeta.bid || null,
    uidHex: uidHex || bodyMeta.uidHex || null,
    productName: productName || bodyMeta.productName || null,
    gender: gender || bodyMeta.gender || null,
    occasion: occasion || bodyMeta.occasion || null,
    gps: body.gps && typeof body.gps === "object" ? body.gps : bodyMeta.gps || {},
    device: body.device && typeof body.device === "object" ? body.device : bodyMeta.device || {},
    engagement: body.engagement && typeof body.engagement === "object" ? body.engagement : bodyMeta.engagement || {},
  };
  const notes = clean(body.notes) || [
    tenantSlug ? `tenant=${tenantSlug}` : "",
    eventId ? `event=${eventId}` : "",
    bid ? `bid=${bid}` : "",
    productName ? `product=${productName}` : "",
    gender ? `gender=${gender}` : "",
    occasion ? `occasion=${occasion}` : "",
    roleInterest ? `role=${roleInterest}` : "",
    message ? `message=${message}` : "",
    estimatedVolume ? `estimated_volume=${estimatedVolume}` : "",
  ].filter(Boolean).join(" | ");

  if (!contact) return json({ ok: false, reason: "contact required" }, 400);

  await ensureLeadsSchema();
  const rows = await sql/*sql*/`
    INSERT INTO leads (locale, contact, name, email, phone, company, country, vertical, role_interest, estimated_volume, tag_type, volume, source, status, message, notes, tenant_id, meta)
    VALUES (${locale}, ${contact}, ${name}, ${email}, ${phone}, ${company}, ${country}, ${vertical}, ${roleInterest}, ${estimatedVolume}, ${tagType}, ${volume}, ${source}, 'new', ${message}, ${notes}, ${tenantId}::uuid, ${JSON.stringify(meta)}::jsonb)
    RETURNING *
  `;
  const lead = rows[0] as Record<string, unknown>;

  await publishRealtimeEvent({
    event_type: "lead.created",
    tenant_id: tenantId,
    tenant_slug: tenantSlug,
    lead_id: String(lead.id || ""),
    source,
    status: "new",
    created_at: String(lead.created_at || new Date().toISOString()),
  });

  const requestMeta = getRequestMeta(req);
  const audit = await logAuditEvent({
    actorId: principal.userId,
    tenantId,
    action: "admin_lead_created",
    resourceType: "lead",
    resourceId: String(lead.id || ""),
    afterData: { status: "new", source, vertical, tag_type: tagType, volume },
    ipAddress: requestMeta.ip,
    userAgent: requestMeta.userAgent,
    requestId: requestMeta.traceId,
  });

  return json({
    ok: true,
    lead,
    ...lead,
    warning: audit.ok ? null : audit.reason,
  }, 201);
}
