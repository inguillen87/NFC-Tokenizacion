import { NextResponse } from "next/server";
import { sql } from "../../../lib/db.js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant");
    
    let shipments;
    if (tenant) {
      shipments = await sql`
        SELECT 
          id, tenant_id, shipment_code, status, sender_name, recipient_name, courier_id, 
          created_at, dispatched_at, delivered_at
        FROM logistics_shipments
        WHERE tenant_id = ${tenant}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    } else {
      shipments = await sql`
        SELECT 
          id, tenant_id, shipment_code, status, sender_name, recipient_name, courier_id, 
          created_at, dispatched_at, delivered_at
        FROM logistics_shipments
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }
    
    // Also get some stats
    const statsResult = await sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit,
        SUM(CASE WHEN status = 'DELIVERED_CLOSED' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'DELIVERED_OPENED' THEN 1 ELSE 0 END) as alerts
      FROM logistics_shipments
      ${tenant ? sql`WHERE tenant_id = ${tenant}` : sql``}
    `;
    
    const stats = statsResult[0] || { total: 0, in_transit: 0, delivered: 0, alerts: 0 };
    
    return NextResponse.json({
      ok: true,
      shipments,
      stats: {
        total: Number(stats.total),
        in_transit: Number(stats.in_transit),
        delivered: Number(stats.delivered),
        alerts: Number(stats.alerts)
      }
    });
  } catch (error: any) {
    console.error("Error fetching logistics shipments:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
