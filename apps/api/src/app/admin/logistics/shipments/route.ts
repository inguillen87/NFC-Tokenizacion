export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../lib/auth";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { json } from "../../../../lib/http";
import { sql } from "../../../../lib/db";
import { createShipment } from "../../../../lib/secure-delivery";
import { ensureSecureDeliverySchema } from "../../../../lib/secure-delivery-schema";

function firstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function positiveQuantity(value: unknown) {
  const parsed = Math.trunc(Number(value || 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        productName: firstString(row.productName, row.product_name, row.name, row.sku),
        quantity: positiveQuantity(row.quantity),
      };
    })
    .filter((item) => item.productName);
}

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

async function listShipments(tenantSlugOrId: string) {
  const hasTenantFilter = Boolean(tenantSlugOrId);
  const query = hasTenantFilter && /^[0-9a-f-]{36}$/i.test(tenantSlugOrId)
    ? sql/*sql*/`
        SELECT
          s.id,
          s.tenant_id,
          t.slug AS tenant_slug,
          s.shipment_code,
          s.status,
          s.tracking_number,
          s.origin_address,
          s.destination_address,
          s.origin_address AS sender_name,
          s.destination_address AS recipient_name,
          ci.code AS courier_id,
          ci.name AS carrier_name,
          s.created_at,
          s.updated_at,
          COUNT(DISTINCT si_item.id)::int AS item_count,
          COALESCE(SUM(si_item.quantity), 0)::int AS item_quantity,
          COUNT(DISTINCT ps.seal_id)::int AS seal_count,
          COUNT(DISTINCT ce.id)::int AS custody_event_count,
          COUNT(DISTINCT rv.id)::int AS verification_count,
          COUNT(DISTINCT dc.id)::int AS claim_count,
          MAX(ce.created_at) AS last_custody_event_at
        FROM shipments s
        JOIN tenants t ON t.id = s.tenant_id
        LEFT JOIN carrier_integrations ci ON ci.id = s.carrier_id
        LEFT JOIN shipment_items si_item ON si_item.shipment_id = s.id
        LEFT JOIN package_seals ps ON ps.shipment_id = s.id
        LEFT JOIN custody_events ce ON ce.shipment_id = s.id
        LEFT JOIN recipient_verifications rv ON rv.shipment_id = s.id
        LEFT JOIN delivery_claims dc ON dc.shipment_id = s.id
        WHERE s.tenant_id = ${tenantSlugOrId}::uuid
        GROUP BY s.id, t.slug, ci.code, ci.name
        ORDER BY s.created_at DESC
        LIMIT 100
      `
    : hasTenantFilter
      ? sql/*sql*/`
          SELECT
            s.id,
            s.tenant_id,
            t.slug AS tenant_slug,
            s.shipment_code,
            s.status,
            s.tracking_number,
            s.origin_address,
            s.destination_address,
            s.origin_address AS sender_name,
            s.destination_address AS recipient_name,
            ci.code AS courier_id,
            ci.name AS carrier_name,
            s.created_at,
            s.updated_at,
            COUNT(DISTINCT si_item.id)::int AS item_count,
            COALESCE(SUM(si_item.quantity), 0)::int AS item_quantity,
            COUNT(DISTINCT ps.seal_id)::int AS seal_count,
            COUNT(DISTINCT ce.id)::int AS custody_event_count,
            COUNT(DISTINCT rv.id)::int AS verification_count,
            COUNT(DISTINCT dc.id)::int AS claim_count,
            MAX(ce.created_at) AS last_custody_event_at
          FROM shipments s
          JOIN tenants t ON t.id = s.tenant_id
          LEFT JOIN carrier_integrations ci ON ci.id = s.carrier_id
          LEFT JOIN shipment_items si_item ON si_item.shipment_id = s.id
          LEFT JOIN package_seals ps ON ps.shipment_id = s.id
          LEFT JOIN custody_events ce ON ce.shipment_id = s.id
          LEFT JOIN recipient_verifications rv ON rv.shipment_id = s.id
          LEFT JOIN delivery_claims dc ON dc.shipment_id = s.id
          WHERE t.slug = ${tenantSlugOrId.toLowerCase()}
          GROUP BY s.id, t.slug, ci.code, ci.name
          ORDER BY s.created_at DESC
          LIMIT 100
        `
      : sql/*sql*/`
          SELECT
            s.id,
            s.tenant_id,
            t.slug AS tenant_slug,
            s.shipment_code,
            s.status,
            s.tracking_number,
            s.origin_address,
            s.destination_address,
            s.origin_address AS sender_name,
            s.destination_address AS recipient_name,
            ci.code AS courier_id,
            ci.name AS carrier_name,
            s.created_at,
            s.updated_at,
            COUNT(DISTINCT si_item.id)::int AS item_count,
            COALESCE(SUM(si_item.quantity), 0)::int AS item_quantity,
            COUNT(DISTINCT ps.seal_id)::int AS seal_count,
            COUNT(DISTINCT ce.id)::int AS custody_event_count,
            COUNT(DISTINCT rv.id)::int AS verification_count,
            COUNT(DISTINCT dc.id)::int AS claim_count,
            MAX(ce.created_at) AS last_custody_event_at
          FROM shipments s
          JOIN tenants t ON t.id = s.tenant_id
          LEFT JOIN carrier_integrations ci ON ci.id = s.carrier_id
          LEFT JOIN shipment_items si_item ON si_item.shipment_id = s.id
          LEFT JOIN package_seals ps ON ps.shipment_id = s.id
          LEFT JOIN custody_events ce ON ce.shipment_id = s.id
          LEFT JOIN recipient_verifications rv ON rv.shipment_id = s.id
          LEFT JOIN delivery_claims dc ON dc.shipment_id = s.id
          GROUP BY s.id, t.slug, ci.code, ci.name
          ORDER BY s.created_at DESC
          LIMIT 100
        `;
  return query;
}

async function getStats(tenantSlugOrId: string) {
  const hasTenantFilter = Boolean(tenantSlugOrId);
  const rows = hasTenantFilter && /^[0-9a-f-]{36}$/i.test(tenantSlugOrId)
    ? await sql/*sql*/`
        SELECT 
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE s.status = 'IN_TRANSIT')::int AS in_transit,
          COUNT(*) FILTER (WHERE s.status = 'DELIVERED_CLOSED')::int AS delivered,
          COUNT(*) FILTER (WHERE s.status IN ('DELIVERED_OPENED', 'QUARANTINED'))::int AS alerts
        FROM shipments s
        WHERE s.tenant_id = ${tenantSlugOrId}::uuid
      `
    : hasTenantFilter
      ? await sql/*sql*/`
          SELECT 
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE s.status = 'IN_TRANSIT')::int AS in_transit,
            COUNT(*) FILTER (WHERE s.status = 'DELIVERED_CLOSED')::int AS delivered,
            COUNT(*) FILTER (WHERE s.status IN ('DELIVERED_OPENED', 'QUARANTINED'))::int AS alerts
          FROM shipments s
          JOIN tenants t ON t.id = s.tenant_id
          WHERE t.slug = ${tenantSlugOrId.toLowerCase()}
        `
      : await sql/*sql*/`
          SELECT 
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'IN_TRANSIT')::int AS in_transit,
            COUNT(*) FILTER (WHERE status = 'DELIVERED_CLOSED')::int AS delivered,
            COUNT(*) FILTER (WHERE status IN ('DELIVERED_OPENED', 'QUARANTINED'))::int AS alerts
          FROM shipments
        `;
  const stats = rows[0] || {};
  return {
    total: Number(stats.total || 0),
    in_transit: Number(stats.in_transit || 0),
    delivered: Number(stats.delivered || 0),
    alerts: Number(stats.alerts || 0),
  };
}

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSecureDeliverySchema();

  const { searchParams } = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantFilter = forcedTenantSlug || firstString(searchParams.get("tenant"), searchParams.get("tenant_id"), searchParams.get("tenant_slug"));
  const shipments = await listShipments(tenantFilter);
  const stats = await getStats(tenantFilter);

  return json({ ok: true, shipments, stats });
}

export async function POST(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  await ensureSecureDeliverySchema();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantInput = forcedTenantSlug || firstString(body.tenant_id, body.tenantId, body.tenant_slug, body.tenantSlug, body.tenant);
  const tenant = await resolveTenant(tenantInput);
  if (!tenant) return json({ ok: false, reason: "tenant_not_found" }, 404);

  if (forcedTenantSlug && forcedTenantSlug !== tenant.slug) {
    return json({ ok: false, reason: "tenant_scope_forbidden" }, 403);
  }

  const items = normalizeItems(body.items);
  const singleProduct = firstString(body.product_name, body.productName, body.sku);
  if (!items.length && singleProduct) {
    items.push({ productName: singleProduct, quantity: positiveQuantity(body.quantity) });
  }

  if (!items.length) {
    return json({ ok: false, reason: "shipment_item_required" }, 400);
  }

  try {
    const shipment = await createShipment({
      tenantId: String(tenant.id),
      shipmentCode: firstString(body.shipment_code, body.shipmentCode),
      carrierCode: firstString(body.carrier_code, body.carrierCode, body.courier_id, body.courierId),
      trackingNumber: firstString(body.tracking_number, body.trackingNumber),
      originAddress: firstString(body.origin_address, body.originAddress, body.sender_name, body.senderName),
      destinationAddress: firstString(body.destination_address, body.destinationAddress, body.recipient_name, body.recipientName),
      items,
    });

    await logAuditEvent({
      actorId: null,
      tenantId: String(tenant.id),
      action: "secure_delivery_shipment_created",
      resourceType: "shipment",
      resourceId: String(shipment.id),
      afterData: {
        shipment_code: shipment.shipmentCode,
        tracking_number: shipment.trackingNumber,
        item_count: shipment.itemCount,
      },
      userAgent: req.headers.get("user-agent"),
      requestId: req.headers.get("x-request-id"),
    });

    return json({ ok: true, shipment }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "shipment_create_failed";
    const status = /duplicate key|unique/i.test(message) ? 409 : 400;
    return json({ ok: false, reason: "shipment_create_failed", message }, status);
  }
}
