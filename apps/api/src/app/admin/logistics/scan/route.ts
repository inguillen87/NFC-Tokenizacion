export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission, getAdminActor, getAdminTenantScope } from "../../../../lib/auth";
import { logAuditEvent } from "../../../../lib/audit-logger";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { processSealScan, type SecureDeliveryScanContext } from "../../../../lib/secure-delivery";
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

import { readBoundedJsonBody } from "../../../../lib/bounded-request-body";
import { logisticsFailure, logisticsOperationKey, logisticsText, LogisticsOperationError } from "../../../../lib/logistics-operation-policy";
export async function POST(req:Request){
  const auth=await checkAdmin(req,["super_admin","tenant_admin"]);if(auth)return auth;
  const permission=checkAdminPermission(req,"logistics:write");if(permission)return permission;
  try {
    await ensureSecureDeliverySchema();
    const body=await readBoundedJsonBody<Record<string,unknown>>(req,65536);
    if(!body||typeof body!=="object"||Array.isArray(body))throw new LogisticsOperationError("logistics_input_invalid");
    const context=normalizeContext(body.context||body.action||body.step);
    if(!context)throw new LogisticsOperationError("logistics_input_invalid");
    const uidHex=logisticsText(body.uidHex??body.uid_hex,14).toUpperCase();
    const shipmentId=logisticsText(body.shipmentId??body.shipment_id,36);
    const {forcedTenantSlug}=getAdminTenantScope(req);
    const tenantInput=forcedTenantSlug||firstString(body.tenant_id,body.tenantId,body.tenant_slug,body.tenantSlug,body.tenant);
    const tenant=tenantInput?await resolveTenant(tenantInput):await resolveTenantByShipment(shipmentId);
    if(!tenant)return json({ok:false,reason:"tenant_not_found"},404);
    if(forcedTenantSlug&&forcedTenantSlug!==tenant.slug)return json({ok:false,reason:"tenant_scope_forbidden"},403);
    const actor=getAdminActor(req);
    const result=await processSealScan({uidHex,tenantId:String(tenant.id),ttRaw:logisticsText(body.ttRaw??body.tt_raw,16)||null,shipmentId:shipmentId||undefined,location:logisticsText(body.location??body.checkpoint,300),scannedBy:logisticsText(body.scannedBy??body.scanned_by??body.operator,180),recipientName:logisticsText(body.recipientName??body.recipient_name,180),verificationMethod:logisticsText(body.verificationMethod??body.verification_method,80),context,operationKey:logisticsOperationKey(req,body),actorScope:`admin:${actor.id||actor.sessionId||"authorized"}`});
    if(!result.replayed)await logAuditEvent({actorId:actor.id,tenantId:String(tenant.id),action:`secure_delivery_scan_${context.toLowerCase()}`,resourceType:"shipment",resourceId:result.shipmentId,afterData:{receipt_id:result.receiptId,context,new_status:result.newStatus},requestId:req.headers.get("x-request-id")});
    return json({ok:true,tenant:{id:tenant.id,slug:tenant.slug,name:tenant.name},context,data:result},200,{"cache-control":"no-store"});
  }catch(error){const failure=logisticsFailure(error);console.warn("[logistics_operation_failed]",failure.reason);return json({ok:false,reason:failure.reason},failure.status,{"cache-control":"no-store"});}
}
