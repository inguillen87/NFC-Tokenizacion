import { randomUUID } from "crypto";
import { sql } from "./db";
import {
  classifyTamperState,
  nextSealStatusForScan,
  resolveSealStatusForScan,
  type SealStatus,
  type SecureDeliveryScanContext,
} from "./secure-delivery-policy";

export { classifyTamperState, nextSealStatusForScan, resolveSealStatusForScan };
export type { SealStatus, SecureDeliveryScanContext, TamperState } from "./secure-delivery-policy";

type CreatedShipment = {
  id: string;
  tenantId: string;
  shipmentCode: string;
  status: string;
  trackingNumber: string | null;
};

function buildShipmentCode() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `SDL-${day}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function positiveQuantity(value: unknown) {
  const parsed = Math.trunc(Number(value || 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function createShipment(params: {
  tenantId: string;
  shipmentCode?: string;
  carrierCode?: string;
  trackingNumber?: string;
  originAddress?: string;
  destinationAddress?: string;
  items?: Array<{ productName?: string; product_name?: string; quantity?: number }>;
}) {
  let carrierId: string | null = null;
  if (params.carrierCode) {
    const rows = await sql/*sql*/`
      SELECT id FROM carrier_integrations
      WHERE tenant_id = ${params.tenantId} AND code = ${params.carrierCode}
      LIMIT 1
    `;
    if (rows.length > 0) {
      carrierId = rows[0].id;
    }
  }

  const shipmentCode = String(params.shipmentCode || "").trim() || buildShipmentCode();

  const res = await sql/*sql*/`
    INSERT INTO shipments (
      tenant_id, shipment_code, carrier_id, tracking_number, status, origin_address, destination_address
    ) VALUES (
      ${params.tenantId}, ${shipmentCode}, ${carrierId}, ${params.trackingNumber || null}, 'draft',
      ${params.originAddress || null}, ${params.destinationAddress || null}
    ) RETURNING id, tenant_id as "tenantId", shipment_code as "shipmentCode", status, tracking_number as "trackingNumber"
  `;
  const shipment = res[0] as CreatedShipment;

  const items = (params.items || [])
    .map((item) => ({
      productName: String(item.productName || item.product_name || "").trim(),
      quantity: positiveQuantity(item.quantity),
    }))
    .filter((item) => item.productName);

  for (const item of items) {
    await sql/*sql*/`
      INSERT INTO shipment_items (shipment_id, product_name, quantity)
      VALUES (${shipment.id}, ${item.productName}, ${item.quantity})
    `;
  }

  return { ...shipment, itemCount: items.length };
}

export async function updateSealState(
  sealId: string,
  targetStatus: SealStatus,
  shipmentId?: string,
  location?: string,
  scannedBy?: string,
  notes?: string
) {
  const [seal] = await sql/*sql*/`
    UPDATE seal_inventory
    SET status = ${targetStatus}, updated_at = now()
    WHERE id = ${sealId}
    RETURNING id, tenant_id as "tenantId", status
  `;

  if (!seal) throw new Error("Seal not found");

  if (shipmentId) {
    const [shipment] = await sql/*sql*/`
      SELECT id FROM shipments
      WHERE id = ${shipmentId} AND tenant_id = ${seal.tenantId}
      LIMIT 1
    `;
    if (!shipment) throw new Error("Shipment not found for tenant");

    await sql/*sql*/`
      INSERT INTO package_seals (shipment_id, seal_id, status, applied_at)
      VALUES (${shipmentId}, ${sealId}, ${targetStatus}, now())
      ON CONFLICT (shipment_id, seal_id) 
      DO UPDATE SET status = EXCLUDED.status, applied_at = COALESCE(package_seals.applied_at, now())
    `;

    await sql/*sql*/`
      INSERT INTO custody_events (tenant_id, shipment_id, seal_id, event_type, location, scanned_by, notes)
      VALUES (${seal.tenantId}, ${shipmentId}, ${sealId}, ${targetStatus}, ${location || null}, ${scannedBy || null}, ${notes || null})
    `;

    await sql/*sql*/`
      UPDATE shipments
      SET status = ${targetStatus}, updated_at = now()
      WHERE id = ${shipmentId} AND tenant_id = ${seal.tenantId}
    `;
  }

  return seal;
}

export async function processSealScan(params: {
  uidHex: string;
  tenantId: string;
  ttRaw: string | null;
  shipmentId?: string;
  location?: string;
  scannedBy?: string;
  context: SecureDeliveryScanContext;
}) {
  const [seal] = await sql/*sql*/`
    SELECT * FROM seal_inventory WHERE uid_hex = ${params.uidHex} AND tenant_id = ${params.tenantId} LIMIT 1
  `;
  if (!seal) {
    throw new Error("Seal not recognized in inventory");
  }

  const [packageSeal] = await sql/*sql*/`
    SELECT * FROM package_seals WHERE seal_id = ${seal.id} ORDER BY created_at DESC LIMIT 1
  `;

  if (params.context === "APPLY" && !params.shipmentId) {
    throw new Error("shipmentId is required to apply a seal");
  }

  if (params.context !== "APPLY" && !packageSeal && !params.shipmentId) {
    throw new Error("Seal is not assigned to a shipment");
  }

  if (params.context === "APPLY" && packageSeal && packageSeal.shipment_id !== params.shipmentId) {
    throw new Error("Seal is already assigned to another shipment");
  }

  const shipmentId = params.shipmentId || packageSeal?.shipment_id || null;
  const tamperState = classifyTamperState(params.ttRaw);
  const targetState = resolveSealStatusForScan(seal.status, params.context, params.ttRaw);

  if (shipmentId || targetState !== seal.status) {
    await updateSealState(seal.id, targetState, shipmentId || undefined, params.location, params.scannedBy, `Transition via scan (${params.context}). ttRaw: ${params.ttRaw || 'N/A'}`);
  }

  return { sealId: seal.id, previousStatus: seal.status, newStatus: targetState, shipmentId, tamperState };
}
