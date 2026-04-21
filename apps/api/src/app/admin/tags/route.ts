export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { parseAnalyticsFilters } from "../../../lib/analytics";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const { tenant, source, range, rangeSql, country } = parseAnalyticsFilters(searchParams);
  const query = (searchParams.get("q") || "").trim();
  const format = (searchParams.get("format") || "json").toLowerCase();
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 200), 1), 1000);

  const rows = await sql/*sql*/`
    SELECT
      t.uid_hex,
      b.bid,
      tn.slug AS tenant_slug,
      COALESCE(tp.product_name, tp.sku, 'Unprofiled bottle') AS product_name,
      tp.winery,
      tp.region,
      tp.vintage,
      t.status AS tag_status,
      t.scan_count,
      t.first_seen_at,
      t.last_seen_at,
      last_evt.result AS last_result,
      last_evt.city AS last_city,
      last_evt.country_code AS last_country,
      tok.status AS tokenization_status,
      tok.network AS tokenization_network,
      tok.tx_hash AS tokenization_tx_hash,
      tok.token_id AS tokenization_token_id
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN LATERAL (
      SELECT e.result, e.city, e.country_code, e.created_at
      FROM events e
      WHERE e.batch_id = t.batch_id
        AND e.uid_hex = t.uid_hex
        AND (${source} = '' OR e.source = ${source}::scan_source)
        AND e.created_at >= now() - ${rangeSql}::interval
      ORDER BY e.created_at DESC
      LIMIT 1
    ) last_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT tr.status, tr.network, tr.tx_hash, tr.token_id, tr.requested_at
      FROM tokenization_requests tr
      WHERE tr.batch_id = t.batch_id AND tr.uid_hex = t.uid_hex
      ORDER BY tr.requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE (${tenant} = '' OR tn.slug = ${tenant})
      AND (${country} = '' OR COALESCE(last_evt.country_code, '') = ${country})
      AND (
        ${query} = ''
        OR t.uid_hex ILIKE ${`%${query}%`}
        OR b.bid ILIKE ${`%${query}%`}
        OR COALESCE(tp.product_name, tp.sku, '') ILIKE ${`%${query}%`}
        OR COALESCE(tp.winery, '') ILIKE ${`%${query}%`}
        OR COALESCE(tp.region, '') ILIKE ${`%${query}%`}
      )
    ORDER BY COALESCE(t.last_seen_at, t.created_at) DESC
    OFFSET ${offset}
    LIMIT ${limit}
  `;

  const totalsRows = await sql/*sql*/`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE t.status = 'active')::int AS active_tags,
      COUNT(*) FILTER (WHERE t.status <> 'active')::int AS non_active_tags,
      COUNT(*) FILTER (WHERE tok.status = 'minted')::int AS minted_tags,
      COUNT(*) FILTER (WHERE tok.status IS NULL OR tok.status = 'none')::int AS pending_tokenization
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN LATERAL (
      SELECT e.country_code
      FROM events e
      WHERE e.batch_id = t.batch_id
        AND e.uid_hex = t.uid_hex
        AND (${source} = '' OR e.source = ${source}::scan_source)
        AND e.created_at >= now() - ${rangeSql}::interval
      ORDER BY e.created_at DESC
      LIMIT 1
    ) last_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT tr.status
      FROM tokenization_requests tr
      WHERE tr.batch_id = t.batch_id AND tr.uid_hex = t.uid_hex
      ORDER BY tr.requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE (${tenant} = '' OR tn.slug = ${tenant})
      AND (${country} = '' OR COALESCE(last_evt.country_code, '') = ${country})
      AND (
        ${query} = ''
        OR t.uid_hex ILIKE ${`%${query}%`}
        OR b.bid ILIKE ${`%${query}%`}
        OR COALESCE(tp.product_name, tp.sku, '') ILIKE ${`%${query}%`}
        OR COALESCE(tp.winery, '') ILIKE ${`%${query}%`}
        OR COALESCE(tp.region, '') ILIKE ${`%${query}%`}
      )
  `;

  const data = (rows as Array<Record<string, unknown>>).map((row) => ({
    uidHex: String(row.uid_hex || ""),
    bid: String(row.bid || ""),
    tenantSlug: String(row.tenant_slug || ""),
    product: {
      name: String(row.product_name || "Unprofiled bottle"),
      winery: String(row.winery || "-"),
      region: String(row.region || "-"),
      vintage: String(row.vintage || "-"),
    },
    status: {
      tag: String(row.tag_status || "unknown"),
      lastResult: String(row.last_result || "unknown"),
    },
    scans: {
      count: Number(row.scan_count || 0),
      firstSeenAt: row.first_seen_at ? String(row.first_seen_at) : null,
      lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    },
    lastVerifiedLocation: {
      city: String(row.last_city || "Unknown"),
      country: String(row.last_country || "--"),
    },
    tokenization: {
      status: String(row.tokenization_status || "none"),
      network: String(row.tokenization_network || "-"),
      txHash: row.tokenization_tx_hash ? String(row.tokenization_tx_hash) : null,
      tokenId: row.tokenization_token_id ? String(row.tokenization_token_id) : null,
    },
  }));

  if (format === "csv") {
    const header = [
      "uidHex",
      "bid",
      "tenantSlug",
      "productName",
      "winery",
      "region",
      "vintage",
      "tagStatus",
      "lastResult",
      "scanCount",
      "firstSeenAt",
      "lastSeenAt",
      "lastCity",
      "lastCountry",
      "tokenizationStatus",
      "tokenizationNetwork",
      "tokenizationTxHash",
      "tokenizationTokenId",
    ];
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const body = [
      header.join(","),
      ...data.map((row) => [
        escapeCsv(row.uidHex),
        escapeCsv(row.bid),
        escapeCsv(row.tenantSlug),
        escapeCsv(row.product.name),
        escapeCsv(row.product.winery),
        escapeCsv(row.product.region),
        escapeCsv(row.product.vintage),
        escapeCsv(row.status.tag),
        escapeCsv(row.status.lastResult),
        escapeCsv(row.scans.count),
        escapeCsv(row.scans.firstSeenAt || ""),
        escapeCsv(row.scans.lastSeenAt || ""),
        escapeCsv(row.lastVerifiedLocation.city),
        escapeCsv(row.lastVerifiedLocation.country),
        escapeCsv(row.tokenization.status),
        escapeCsv(row.tokenization.network),
        escapeCsv(row.tokenization.txHash || ""),
        escapeCsv(row.tokenization.tokenId || ""),
      ].join(",")),
    ].join("\n");
    const filename = `tags-${tenant || "global"}-${range}.csv`;
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return json({
    scope: {
      tenant: tenant || "global",
      source: source || "all",
      range,
      country: country || "all",
      query,
      offset,
      limit,
    },
    totals: totalsRows[0] || { total: 0, active_tags: 0, non_active_tags: 0, minted_tags: 0, pending_tokenization: 0 },
    rows: data,
  });
}
