import { readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { logisticsFailure, logisticsItems, logisticsOperationKey, logisticsText, LogisticsOperationError } from "../../../../lib/logistics-operation-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
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

async function resolveTenant(input: string) {
  const normalized = input.trim();
  if (!normalized) return null;
  const rows = /^[0-9a-f-]{36}$/i.test(normalized)
    ? await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE id = ${normalized}::uuid LIMIT 1`
    : await sql/*sql*/`SELECT id, slug, name FROM tenants WHERE slug = ${normalized.toLowerCase()} LIMIT 1`;
  return rows[0] || null;
}

async function listShipments(tenantSlugOrId:string){
  const isId=/^[0-9a-f-]{36}$/i.test(tenantSlugOrId);
  return sql`
    SELECT s.id,s.tenant_id,t.slug AS tenant_slug,s.shipment_code,s.status,s.tracking_number,
      s.origin_address,s.destination_address,s.origin_address AS sender_name,s.destination_address AS recipient_name,
      ci.code AS courier_id,ci.name AS carrier_name,s.created_at,s.updated_at,
      (SELECT count(*)::int FROM shipment_items i WHERE i.shipment_id=s.id) AS item_count,
      (SELECT coalesce(sum(i.quantity),0)::int FROM shipment_items i WHERE i.shipment_id=s.id) AS item_quantity,
      (SELECT count(*)::int FROM package_seals x WHERE x.shipment_id=s.id) AS seal_count,
      (SELECT count(*)::int FROM custody_events x WHERE x.shipment_id=s.id) AS custody_event_count,
      (SELECT count(*)::int FROM recipient_verifications x WHERE x.shipment_id=s.id) AS verification_count,
      (SELECT count(*)::int FROM delivery_claims x WHERE x.shipment_id=s.id) AS claim_count,
      (SELECT max(x.created_at) FROM custody_events x WHERE x.shipment_id=s.id) AS last_custody_event_at
    FROM shipments s JOIN tenants t ON t.id=s.tenant_id
    LEFT JOIN carrier_integrations ci ON ci.id=s.carrier_id AND ci.tenant_id=s.tenant_id
    WHERE (${tenantSlugOrId}='' OR (${isId} AND s.tenant_id=${isId?tenantSlugOrId:null}::uuid) OR (NOT ${isId} AND t.slug=${tenantSlugOrId.toLowerCase()}))
    ORDER BY s.created_at DESC,s.id DESC LIMIT 100
  `;
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
  const permission=checkAdminPermission(req,"logistics:read");if(permission)return permission;
  await ensureSecureDeliverySchema();

  const { searchParams } = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantFilter = forcedTenantSlug || firstString(searchParams.get("tenant"), searchParams.get("tenant_id"), searchParams.get("tenant_slug"));
  const shipments = await listShipments(tenantFilter);
  const stats = await getStats(tenantFilter);

  return json({ ok:true, shipments, stats, dataSource:"production", observedAt:new Date().toISOString(), scope:{tenant:tenantFilter||null,limit:100}, operationProtocol:"nexid.logistics.v1" },200,{"cache-control":"no-store"});
}

export async function POST(req:Request){
  const auth=await checkAdmin(req,["super_admin","tenant_admin"]);if(auth)return auth;
  const permission=checkAdminPermission(req,"logistics:write");if(permission)return permission;
  try {
    await ensureSecureDeliverySchema();
    const body=await readBoundedJsonBody<Record<string,unknown>>(req,65536);
    if(!body||typeof body!=="object"||Array.isArray(body))throw new LogisticsOperationError("logistics_input_invalid");
    const {forcedTenantSlug}=getAdminTenantScope(req);
    const tenantInput=forcedTenantSlug||firstString(body.tenant_id,body.tenantId,body.tenant_slug,body.tenantSlug,body.tenant);
    const tenant=await resolveTenant(tenantInput);if(!tenant)return json({ok:false,reason:"tenant_not_found"},404);
    if(forcedTenantSlug&&forcedTenantSlug!==tenant.slug)return json({ok:false,reason:"tenant_scope_forbidden"},403);
    const items=logisticsItems(body.items??[{productName:body.product_name??body.productName??body.sku,quantity:body.quantity??1}]);
    const actor=getAdminActor(req);
    const shipment=await createShipment({tenantId:String(tenant.id),shipmentCode:logisticsText(body.shipment_code??body.shipmentCode,120),carrierCode:logisticsText(body.carrier_code??body.carrierCode??body.courier_id??body.courierId,100),trackingNumber:logisticsText(body.tracking_number??body.trackingNumber,180),originAddress:logisticsText(body.origin_address??body.originAddress??body.sender_name??body.senderName,500),destinationAddress:logisticsText(body.destination_address??body.destinationAddress??body.recipient_name??body.recipientName,500),items,operationKey:logisticsOperationKey(req,body),actorScope:`admin:${actor.id||actor.sessionId||"authorized"}`});
    if(!shipment.replayed)await logAuditEvent({actorId:actor.id,tenantId:String(tenant.id),action:"secure_delivery_shipment_created",resourceType:"shipment",resourceId:shipment.id,afterData:{receipt_id:shipment.receiptId,item_count:shipment.itemCount},requestId:req.headers.get("x-request-id")});
    return json({ok:true,tenant:{slug:tenant.slug},shipment},shipment.replayed?200:201,{"cache-control":"no-store"});
  }catch(error){const failure=logisticsFailure(error);console.warn("[logistics_create_failed]",failure.reason);return json({ok:false,reason:failure.reason},failure.status,{"cache-control":"no-store"});}
}
