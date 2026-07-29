export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { processSealScan, type SecureDeliveryScanContext } from "../../../../lib/secure-delivery";
import {
  recipientVerificationStatusForSealStatus,
  shouldCreateDeliveryClaimForStatus,
} from "../../../../lib/secure-delivery-policy";
import { ensureSecureDeliverySchema } from "../../../../lib/secure-delivery-schema";

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function normalizeContext(value: unknown): SecureDeliveryScanContext | null {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "APPLY" || normalized === "HANDOFF" || normalized === "VERIFY") return normalized;
  return null;
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

async function resolveTenantByShipment(shipmentId: string) {
  if (!shipmentId) return null;
  const rows = await sql/*sql*/`
    SELECT t.id, t.slug, t.name
    FROM shipments s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = ${shipmentId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSecureDeliverySchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const context = normalizeContext(body.context || body.action || body.step);
  if (!context) return json({ ok: false, reason: "invalid_scan_context" }, 400);

  const uidHex = firstString(body.uidHex, body.uid_hex).toUpperCase();
  if (!uidHex) return json({ ok: false, reason: "uidHex_required" }, 400);

  const shipmentId = firstString(body.shipmentId, body.shipment_id);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantInput = forcedTenantSlug || firstString(body.tenant_id, body.tenantId, body.tenant_slug, body.tenantSlug, body.tenant);
  const tenant = tenantInput ? await resolveTenant(tenantInput) : await resolveTenantByShipment(shipmentId);
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);

  if (forcedTenantSlug && forcedTenantSlug !== tenant.slug) {
    return json({ ok: false, reason: "tenant_scope_forbidden" }, 403);
  }

  const scannedBy = firstString(body.scannedBy, body.scanned_by, body.operator, body.recipientName);
  const result = await processSealScan({
    uidHex,
    tenantId: String(tenant.id),
    ttRaw: firstString(body.ttRaw, body.tt_raw) || null,
    shipmentId: shipmentId || undefined,
    location: firstString(body.location, body.checkpoint),
    scannedBy,
    context,
  });

  if (context === "VERIFY" && result.shipmentId) {
    const verificationStatus = recipientVerificationStatusForSealStatus(result.newStatus);
    await sql/*sql*/`
      INSERT INTO recipient_verifications (tenant_id, shipment_id, recipient_name, verification_method, status, verified_at)
      VALUES (
        ${tenant.id},
        ${result.shipmentId},
        ${firstString(body.recipientName, body.recipient_name) || null},
        ${firstString(body.verificationMethod, body.verification_method) || "NFC_TAP"},
        ${verificationStatus},
        now()
      )
    `;

    if (shouldCreateDeliveryClaimForStatus(result.newStatus)) {
      const issueType = result.newStatus === "DELIVERED_OPENED" ? "tamper_reported" : "seal_review_required";
      await sql/*sql*/`
        INSERT INTO delivery_claims (tenant_id, shipment_id, issue_type, description, status)
        SELECT
          ${tenant.id},
          ${result.shipmentId},
          ${issueType},
          ${`Recipient verification moved shipment to ${result.newStatus}; tamper state ${result.tamperState}.`},
          'open'
        WHERE NOT EXISTS (
          SELECT 1
          FROM delivery_claims
          WHERE shipment_id = ${result.shipmentId}
            AND issue_type = ${issueType}
            AND status = 'open'
        )
      `;
    }
  }

  await logAuditEvent({
    actorId: getAdminActor(req).id,
    tenantId: String(tenant.id),
    action: `secure_delivery_scan_${context.toLowerCase()}`,
    resourceType: "shipment",
    resourceId: result.shipmentId || shipmentId || null,
    afterData: {
      uid_hex: uidHex,
      context,
      tamper_state: result.tamperState,
      new_status: result.newStatus,
      location: firstString(body.location, body.checkpoint) || null,
    },
    userAgent: req.headers.get("user-agent"),
    requestId: req.headers.get("x-request-id"),
  });

  return json({
    ok: true,
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    context,
    data: result,
  });
}
