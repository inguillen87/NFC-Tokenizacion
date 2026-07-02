export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../../lib/auth";
import { logAuditEvent } from "../../../../../../lib/audit-logger";
import { sql } from "../../../../../../lib/db";
import { json } from "../../../../../../lib/http";
import { ensureSecureDeliverySchema } from "../../../../../../lib/secure-delivery-schema";

function clean(value: unknown) {
  return String(value || "").trim();
}

async function resolveShipment(shipmentId: string, forcedTenantSlug = "") {
  const rows = await sql/*sql*/`
    SELECT s.id, s.tenant_id, s.shipment_code, t.slug AS tenant_slug
    FROM shipments s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE (s.id::text = ${shipmentId} OR s.shipment_code = ${shipmentId})
      AND (${forcedTenantSlug} = '' OR t.slug = ${forcedTenantSlug})
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function POST(req: Request, context: { params: Promise<{ shipmentId: string }> }) {
  const auth = checkAdmin(req, ["super_admin", "security_operator", "tenant_admin"]);
  if (auth) return auth;
  await ensureSecureDeliverySchema();

  const { shipmentId } = await context.params;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const shipment = await resolveShipment(decodeURIComponent(shipmentId || ""), forcedTenantSlug);
  if (!shipment) return json({ ok: false, reason: "shipment_not_found" }, 404);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const issueType = clean(body.issue_type || body.issueType || "tamper_report");
  const description = clean(body.description);
  if (!description) return json({ ok: false, reason: "claim_description_required" }, 400);

  const rows = await sql/*sql*/`
    INSERT INTO delivery_claims (tenant_id, shipment_id, issue_type, description, status)
    VALUES (${shipment.tenant_id}, ${shipment.id}, ${issueType}, ${description}, 'open')
    RETURNING id, issue_type, description, status, created_at, updated_at
  `;
  const claim = rows[0];

  await sql/*sql*/`
    UPDATE shipments
    SET status = CASE WHEN status = 'DELIVERED_CLOSED' THEN status ELSE 'QUARANTINED' END,
        updated_at = now()
    WHERE id = ${shipment.id}
  `;

  await sql/*sql*/`
    INSERT INTO custody_events (tenant_id, shipment_id, event_type, location, scanned_by, notes)
    VALUES (
      ${shipment.tenant_id},
      ${shipment.id},
      'CLAIM_OPENED',
      ${clean(body.location) || null},
      ${clean(body.reported_by || body.reportedBy) || req.headers.get("x-nexid-actor") || null},
      ${description}
    )
  `;

  await logAuditEvent({
    actorId: req.headers.get("x-nexid-actor-id"),
    tenantId: String(shipment.tenant_id),
    action: "secure_delivery_claim_opened",
    resourceType: "shipment",
    resourceId: String(shipment.id),
    afterData: {
      shipment_code: shipment.shipment_code,
      issue_type: issueType,
      claim_id: claim.id,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({ ok: true, claim }, 201);
}
