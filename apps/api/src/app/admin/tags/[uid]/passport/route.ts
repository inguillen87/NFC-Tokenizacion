export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../../lib/auth";
import { normalizeBrowser, normalizeDeviceType, normalizeOs, normalizeTimezone, parseAnalyticsFilters } from "../../../../../lib/analytics";
import { sql } from "../../../../../lib/db";
import { json } from "../../../../../lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const resolvedParams = await params;
  const uidHex = decodeURIComponent(resolvedParams.uid || "").toUpperCase().trim();
  if (!uidHex) return json({ ok: false, reason: "uid required" }, 400);

  const { searchParams } = new URL(req.url);
  const { tenant, source, range, rangeSql, country } = parseAnalyticsFilters(searchParams);

  const profileRows = await sql/*sql*/`
    SELECT
      t.uid_hex,
      b.bid,
      tn.slug AS tenant_slug,
      tp.product_name,
      tp.sku,
      tp.winery,
      tp.region,
      tp.grape_varietal,
      tp.vintage,
      tp.harvest_year,
      tp.barrel_months,
      tp.temperature_storage,
      t.status AS tag_status,
      t.scan_count,
      t.first_seen_at,
      t.last_seen_at,
      first_evt.created_at AS first_verified_at,
      first_evt.city AS first_city,
      first_evt.country_code AS first_country,
      first_evt.lat AS first_lat,
      first_evt.lng AS first_lng,
      last_evt.created_at AS last_verified_at,
      last_evt.result AS last_result,
      last_evt.city AS last_city,
      last_evt.country_code AS last_country,
      last_evt.lat AS last_lat,
      last_evt.lng AS last_lng,
      last_evt.device_label AS last_device,
      tok.status AS tokenization_status,
      tok.network,
      tok.tx_hash,
      tok.token_id
    FROM tags t
    JOIN batches b ON b.id = t.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    LEFT JOIN tag_profiles tp ON tp.tag_id = t.id
    LEFT JOIN LATERAL (
      SELECT created_at, city, country_code, lat, lng
      FROM events e
      WHERE e.batch_id = t.batch_id AND e.uid_hex = t.uid_hex
        AND (${source} = '' OR e.source = ${source}::scan_source)
        AND e.created_at >= now() - ${rangeSql}::interval
      ORDER BY created_at ASC
      LIMIT 1
    ) first_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT created_at, result, city, country_code, lat, lng, device_label
      FROM events e
      WHERE e.batch_id = t.batch_id AND e.uid_hex = t.uid_hex
        AND (${source} = '' OR e.source = ${source}::scan_source)
        AND e.created_at >= now() - ${rangeSql}::interval
      ORDER BY created_at DESC
      LIMIT 1
    ) last_evt ON TRUE
    LEFT JOIN LATERAL (
      SELECT status, network, tx_hash, token_id
      FROM tokenization_requests tr
      WHERE tr.batch_id = t.batch_id AND tr.uid_hex = t.uid_hex
      ORDER BY requested_at DESC
      LIMIT 1
    ) tok ON TRUE
    WHERE t.uid_hex = ${uidHex}
      AND (${tenant} = '' OR tn.slug = ${tenant})
    LIMIT 1
  `;

  const profile = profileRows[0];
  if (!profile) return json({ ok: false, reason: "tag not found" }, 404);

  const timeline = await sql/*sql*/`
    SELECT
      e.id,
      e.created_at,
      e.result,
      e.reason,
      e.city,
      e.country_code,
      e.lat,
      e.lng,
      e.device_label,
      e.user_agent,
      e.source,
      e.read_counter,
      e.meta
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    JOIN tenants tn ON tn.id = b.tenant_id
    WHERE e.uid_hex = ${uidHex}
      AND b.bid = ${profile.bid}
      AND (${tenant} = '' OR tn.slug = ${tenant})
      AND (${source} = '' OR e.source = ${source}::scan_source)
      AND (${country} = '' OR COALESCE(NULLIF(e.country_code, ''), NULLIF(e.geo_country, '')) = ${country})
      AND e.created_at >= now() - ${rangeSql}::interval
    ORDER BY e.created_at DESC
    LIMIT 100
  `;

  const timelineRows = (timeline as Array<Record<string, unknown>>).map((row) => {
    const sunClient = (row.meta && typeof row.meta === "object"
      ? (row.meta as { sun_context?: { client?: Record<string, unknown> } }).sun_context?.client
      : null) || {};
    const platform = sunClient.platform ?? null;
    const browser = sunClient.browser ?? null;
    const timezone = sunClient.timezone ?? null;
    const mobile = sunClient.mobile ?? null;
    return {
      id: Number(row.id),
      createdAt: String(row.created_at || ""),
      result: String(row.result || ""),
      reason: String(row.reason || ""),
      location: {
        city: String(row.city || "Unknown"),
        country: String(row.country_code || "--"),
        lat: typeof row.lat === "number" ? Number(row.lat) : null,
        lng: typeof row.lng === "number" ? Number(row.lng) : null,
      },
      readCounter: Number(row.read_counter || 0),
      source: String(row.source || "real"),
      device: {
        label: String(row.device_label || "Unknown"),
        os: normalizeOs({ platform, userAgent: row.user_agent, deviceLabel: row.device_label }),
        browser: normalizeBrowser({ browser, userAgent: row.user_agent, platform, mobile }),
        deviceType: normalizeDeviceType({ mobile, userAgent: row.user_agent, platform, deviceLabel: row.device_label }),
        timezone: normalizeTimezone(timezone),
      },
    };
  });

  return json({
    ok: true,
    scope: { tenant: tenant || String(profile.tenant_slug || ""), source: source || "all", range, country: country || "all" },
    passport: {
      identity: {
        uidHex: String(profile.uid_hex),
        bid: String(profile.bid),
        tenantSlug: String(profile.tenant_slug),
        tagStatus: String(profile.tag_status || "unknown"),
        readCounter: timelineRows[0]?.readCounter ?? 0,
        scanCount: Number(profile.scan_count || 0),
      },
      product: {
        productName: String(profile.product_name || profile.sku || "Unprofiled bottle"),
        winery: String(profile.winery || "-"),
        region: String(profile.region || "-"),
        vintage: String(profile.vintage || "-"),
        varietal: String(profile.grape_varietal || "-"),
      },
      provenance: {
        origin: {
          harvestYear: profile.harvest_year ? String(profile.harvest_year) : null,
          barrelMonths: profile.barrel_months != null ? Number(profile.barrel_months) : null,
          temperatureStorage: profile.temperature_storage != null ? Number(profile.temperature_storage) : null,
        },
        firstVerified: {
          at: profile.first_verified_at ? String(profile.first_verified_at) : null,
          city: String(profile.first_city || "Unknown"),
          country: String(profile.first_country || "--"),
          lat: typeof profile.first_lat === "number" ? Number(profile.first_lat) : null,
          lng: typeof profile.first_lng === "number" ? Number(profile.first_lng) : null,
        },
        lastVerified: {
          at: profile.last_verified_at ? String(profile.last_verified_at) : null,
          result: String(profile.last_result || "unknown"),
          city: String(profile.last_city || "Unknown"),
          country: String(profile.last_country || "--"),
          lat: typeof profile.last_lat === "number" ? Number(profile.last_lat) : null,
          lng: typeof profile.last_lng === "number" ? Number(profile.last_lng) : null,
          deviceLabel: String(profile.last_device || "Unknown"),
        },
      },
      tokenization: {
        status: String(profile.tokenization_status || "none"),
        network: String(profile.network || "-"),
        txHash: profile.tx_hash ? String(profile.tx_hash) : null,
        tokenId: profile.token_id ? String(profile.token_id) : null,
      },
    },
    timeline: timelineRows,
  });
}
