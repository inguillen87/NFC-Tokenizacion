import { sql } from "./db";

export type SealStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "SEALED"
  | "IN_TRANSIT"
  | "DELIVERED_CLOSED"
  | "DELIVERED_OPENED"
  | "QUARANTINED"
  | "VOIDED";

export async function createShipment(params: {
  tenantId: string;
  carrierCode?: string;
  trackingNumber?: string;
  originAddress?: string;
  destinationAddress?: string;
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

  const shipmentCode = `SHP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const res = await sql/*sql*/`
    INSERT INTO shipments (
      tenant_id, shipment_code, carrier_id, tracking_number, status, origin_address, destination_address
    ) VALUES (
      ${params.tenantId}, ${shipmentCode}, ${carrierId}, ${params.trackingNumber || null}, 'draft',
      ${params.originAddress || null}, ${params.destinationAddress || null}
    ) RETURNING id, shipment_code as "shipmentCode", status
  `;
  return res[0];
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
  }

  return seal;
}

export async function processSealScan(params: {
  uidHex: string;
  tenantId: string;
  ttRaw: string | null;
  location?: string;
  scannedBy?: string;
  context: "APPLY" | "HANDOFF" | "VERIFY";
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

  const shipmentId = packageSeal ? packageSeal.shipment_id : null;
  
  const isOpen = params.ttRaw === "4F4F" || params.ttRaw === "4F43" || params.ttRaw === "4949";
  const isClosed = params.ttRaw === "4343";
  let targetState = seal.status;

  if (params.context === "APPLY") {
    if (isOpen) {
      targetState = "QUARANTINED";
    } else {
      targetState = "SEALED";
    }
  } else if (params.context === "HANDOFF") {
    if (isOpen) {
      targetState = "QUARANTINED";
    } else {
      targetState = "IN_TRANSIT";
    }
  } else if (params.context === "VERIFY") {
    if (isOpen) {
      targetState = "DELIVERED_OPENED";
    } else {
      targetState = "DELIVERED_CLOSED";
    }
  }

  if (targetState !== seal.status) {
    await updateSealState(seal.id, targetState, shipmentId, params.location, params.scannedBy, `Transition via scan (${params.context}). ttRaw: ${params.ttRaw || 'N/A'}`);
  }

  return { sealId: seal.id, previousStatus: seal.status, newStatus: targetState, shipmentId };
}
