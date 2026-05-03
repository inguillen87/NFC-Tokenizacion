export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { getConsumerFromRequest } from "../../../lib/consumer-auth";
import { json } from "../../../lib/http";
import { sql } from "../../../lib/db";
import { ensureConsumerPortalSchema } from "../../../lib/commercial-runtime-schema";
import { ensureTokenizationRequestsSchema } from "../../../lib/tokenization-schema";
export async function GET(req: Request) {
  await ensureConsumerPortalSchema();
  await ensureTokenizationRequestsSchema();
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
      ow.status AS ownership_record_status,
      latest_evt.result AS latest_verdict,
      latest_evt.city AS latest_city,
      latest_evt.country_code AS latest_country,
      latest_evt.created_at AS latest_tap_at,
      tok.status AS tokenization_status,
      tok.network AS tokenization_network,
      tok.tx_hash AS tokenization_tx_hash,
      tok.token_id AS tokenization_token_id,
      tok.processed_at AS tokenization_processed_at
    FROM consumer_products cp
    JOIN tenants t ON t.id = cp.tenant_id
    LEFT JOIN batches b ON b.id = (
      SELECT e.batch_id FROM events e WHERE e.id = cp.latest_tap_event_id LIMIT 1
    )
    LEFT JOIN LATERAL (
      SELECT e.result, e.city, e.country_code, e.created_at
      FROM events e
      WHERE e.id = cp.latest_tap_event_id
      LIMIT 1
    ) latest_evt ON TRUE
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
    LEFT JOIN LATERAL (
      SELECT tr.status, tr.network, tr.tx_hash, tr.token_id, tr.processed_at
      FROM tokenization_requests tr
      WHERE tr.bid = b.bid
        AND (
          UPPER(tr.uid_hex) = UPPER(COALESCE(ow.uid_hex, cp.product_passport_id, ''))
          OR tr.asset_ref = CONCAT(b.bid, ':', COALESCE(ow.uid_hex, cp.product_passport_id, ''))
        )
      ORDER BY tr.requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE cp.consumer_id = ${consumer.id}
    ORDER BY (cp.ownership_status = 'claimed') DESC, cp.updated_at DESC
  `;
  return json({ ok: true, items: rows });
}
