import { sql, type SqlExecutor } from "./db";

const MAX_EVENT_ID = 9_223_372_036_854_775_807n;

export function canonicalConsumerTapEventId(value: unknown): string | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value)) return null;
  return BigInt(value) <= MAX_EVENT_ID ? value : null;
}

export type ConsumerTapDetail = {
  tap_event_id: string;
  verdict: string | null;
  risk_level: string | null;
  city: string | null;
  country: string | null;
  created_at: string | null;
  tenant_slug: string;
  tenant_name: string;
  product_name?: string;
  brand_name?: string;
  bid?: string;
};

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}

function timestamp(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function getPrivateConsumerTapDetail(
  consumerId: string,
  eventId: string,
  executor: SqlExecutor = sql,
): Promise<ConsumerTapDetail | null> {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(consumerId) || !canonicalConsumerTapEventId(eventId)) return null;

  // Ownership and tenant matching are part of the same read. A product only
  // authorizes the first/latest event it already references, never other taps
  // of its tag or batch. Do not copy the broader public passport projection.
  const rows = await executor/*sql*/`
    SELECT
      event.id::text AS tap_event_id,
      CASE WHEN history.id IS NOT NULL THEN history.verdict ELSE event.result END AS verdict,
      CASE WHEN history.id IS NOT NULL THEN history.risk_level ELSE event.risk_level::text END AS risk_level,
      CASE WHEN history.id IS NOT NULL THEN history.city ELSE event.city END AS city,
      CASE WHEN history.id IS NOT NULL THEN history.country ELSE event.country_code END AS country,
      CASE WHEN history.id IS NOT NULL THEN history.created_at ELSE event.created_at END AS created_at,
      tenant.slug AS tenant_slug,
      tenant.name AS tenant_name,
      product.product_name,
      product.brand_name,
      batch.bid
    FROM events event
    JOIN tenants tenant ON tenant.id = event.tenant_id
    LEFT JOIN consumer_tap_history history
      ON history.consumer_id = ${consumerId}::uuid
     AND history.tenant_id = event.tenant_id
     AND history.tap_event_id = event.id
    LEFT JOIN LATERAL (
      SELECT cp.id, cp.product_name, cp.brand_name
      FROM consumer_products cp
      WHERE cp.consumer_id = ${consumerId}::uuid
        AND cp.tenant_id = event.tenant_id
        AND (cp.first_tap_event_id = event.id OR cp.latest_tap_event_id = event.id)
      ORDER BY cp.updated_at DESC, cp.id DESC
      LIMIT 1
    ) product ON true
    LEFT JOIN batches batch
      ON batch.id = event.batch_id AND batch.tenant_id = event.tenant_id
    WHERE event.id = ${eventId}::bigint
      AND (history.id IS NOT NULL OR product.id IS NOT NULL)
    LIMIT 2
  `;

  // Partitioned events have a composite primary key (id, created_at). Never
  // select an arbitrary candidate when an authorized ID resolves twice.
  if (rows.length !== 1 || String(rows[0].tap_event_id) !== eventId) return null;
  const row = rows[0];
  const productName = text(row.product_name, 200);
  const brandName = text(row.brand_name, 200);
  const bid = text(row.bid, 160);
  // Older collections use the full tag UID as a fallback product name.
  const isUidFallback = productName && /^Producto\s+[a-f\d]{8,64}$/i.test(productName);

  return {
    tap_event_id: eventId,
    verdict: text(row.verdict, 80),
    risk_level: text(row.risk_level, 80),
    city: text(row.city, 160),
    country: text(row.country, 160),
    created_at: timestamp(row.created_at),
    tenant_slug: text(row.tenant_slug, 160) || "",
    tenant_name: text(row.tenant_name, 200) || "",
    ...(productName && !isUidFallback ? { product_name: productName } : {}),
    ...(brandName ? { brand_name: brandName } : {}),
    ...(bid ? { bid } : {}),
  };
}
