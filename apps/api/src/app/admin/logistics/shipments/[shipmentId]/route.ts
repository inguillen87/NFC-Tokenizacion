export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, getAdminTenantScope } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";
import { ensureSecureDeliverySchema } from "../../../../../lib/secure-delivery-schema";

async function getShipment(shipmentId: string, forcedTenantSlug = "") {
  const rows = await sql/*sql*/`
    SELECT
      s.id,
      s.tenant_id,
      t.slug AS tenant_slug,
      t.name AS tenant_name,
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
    WHERE (s.id::text = ${shipmentId} OR s.shipment_code = ${shipmentId})
      AND (${forcedTenantSlug} = '' OR t.slug = ${forcedTenantSlug})
    GROUP BY s.id, t.slug, t.name, ci.code, ci.name
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function GET(req: Request, context: { params: Promise<{ shipmentId: string }> }) {
  const auth = checkAdmin(req, ["super_admin", "security_operator", "tenant_admin"]);
  if (auth) return auth;
  await ensureSecureDeliverySchema();

  const { shipmentId } = await context.params;
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const shipment = await getShipment(decodeURIComponent(shipmentId || ""), forcedTenantSlug);
  if (!shipment) return json({ ok: false, reason: "shipment_not_found" }, 404);

  const [items, seals, custodyEvents, verifications, claims] = await Promise.all([
    sql/*sql*/`
      SELECT id, product_name, quantity, created_at
      FROM shipment_items
      WHERE shipment_id = ${shipment.id}
      ORDER BY created_at ASC
    `,
    sql/*sql*/`
      SELECT
        ps.id,
        ps.status,
        ps.applied_at,
        ps.created_at,
        si.id AS seal_id,
        si.uid_hex,
        si.status AS inventory_status,
        si.updated_at AS seal_updated_at
      FROM package_seals ps
      JOIN seal_inventory si ON si.id = ps.seal_id
      WHERE ps.shipment_id = ${shipment.id}
      ORDER BY ps.created_at ASC
    `,
    sql/*sql*/`
      SELECT id, event_type, location, scanned_by, notes, created_at
      FROM custody_events
      WHERE shipment_id = ${shipment.id}
      ORDER BY created_at ASC
    `,
    sql/*sql*/`
      SELECT id, recipient_name, verification_method, status, verified_at, created_at
      FROM recipient_verifications
      WHERE shipment_id = ${shipment.id}
      ORDER BY created_at DESC
    `,
    sql/*sql*/`
      SELECT id, issue_type, description, status, created_at, updated_at
      FROM delivery_claims
      WHERE shipment_id = ${shipment.id}
      ORDER BY created_at DESC
    `,
  ]);

  return json({
    ok: true,
    shipment,
    items,
    seals,
    custodyEvents,
    verifications,
    claims,
  });
}
