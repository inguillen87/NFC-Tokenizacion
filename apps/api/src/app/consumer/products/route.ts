export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
export async function GET(req: Request) {
  const consumer = await getConsumerFromRequest(req);
  if (!consumer) return json({ ok: false, error: "unauthorized" }, 401);
  const rows = await sql/*sql*/`
    SELECT
      cp.id,
      cp.product_name,
      cp.brand_name,
      cp.collection_type,
      cp.ownership_status,
      cp.first_tap_event_id,
      cp.latest_tap_event_id,
      cp.created_at,
      t.slug AS tenant_slug,
      b.bid,
      ow.uid_hex AS ownership_uid_hex,
      ow.status AS ownership_record_status
    FROM consumer_products cp
    JOIN tenants t ON t.id = cp.tenant_id
    LEFT JOIN batches b ON b.id = (
      SELECT e.batch_id FROM events e WHERE e.id = cp.latest_tap_event_id LIMIT 1
    )
    LEFT JOIN LATERAL (
      SELECT o.uid_hex, o.status
      FROM consumer_product_ownerships o
      WHERE o.consumer_id = cp.consumer_id
        AND o.tenant_id = cp.tenant_id
        AND (
          (cp.product_passport_id IS NOT NULL AND UPPER(o.uid_hex) = UPPER(cp.product_passport_id))
          OR (cp.product_passport_id IS NULL AND o.event_id = cp.latest_tap_event_id)
        )
      ORDER BY o.claimed_at DESC
      LIMIT 1
    ) ow ON TRUE
    WHERE cp.consumer_id = ${consumer.id}
    ORDER BY (cp.ownership_status = 'claimed') DESC, cp.updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
