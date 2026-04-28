export const runtime = "nodejs";

import { sql } from "../../../../lib/db";

function maskUid(uidHex: string | null | undefined) {
  const value = String(uidHex || "").toUpperCase().replace(/[^A-F0-9]/g, "");
  if (!value) return "UID-NA";
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export async function GET() {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const metricsRows = await sql/*sql*/`
    SELECT
      COUNT(*) FILTER (WHERE e.created_at >= date_trunc('day', now()))::int AS taps_today,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE UPPER(COALESCE(e.result, '')) IN ('VALID', 'VALID_CLOSED'))
        / NULLIF(COUNT(*), 0),
        1
      ) AS valid_rate,
      COUNT(*) FILTER (WHERE UPPER(COALESCE(e.result, '')) IN ('REPLAY_SUSPECT', 'DUPLICATE', 'TAMPER', 'TAMPERED', 'INVALID', 'REVOKED', 'BROKEN'))::int AS risk_blocked,
      COUNT(DISTINCT COALESCE(NULLIF(e.country_code, ''), 'UNK')) FILTER (WHERE e.created_at >= ${windowStart})::int AS active_regions,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(e.source, 'real')) = 'demo')::int AS demo_events,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(e.source, 'real')) <> 'demo')::int AS prod_events
    FROM events e
  `;

  const latestRows = await sql/*sql*/`
    SELECT
      e.created_at,
      e.result,
      COALESCE(NULLIF(e.city, ''), 'Unknown') AS city,
      COALESCE(NULLIF(e.country_code, ''), 'UNK') AS country,
      e.uid_hex,
      COALESCE(t.slug, 'tenant') AS tenant_slug
    FROM events e
    LEFT JOIN tenants t ON t.id = e.tenant_id
    ORDER BY e.created_at DESC
    LIMIT 12
  `;

  const metrics = metricsRows[0] || {};
  const validRate = Number(metrics.valid_rate || 0);
  const prodEvents = Number(metrics.prod_events || 0);
  const demoEvents = Number(metrics.demo_events || 0);
  const demoMode = process.env.DEMO_MODE === "true" || (prodEvents === 0 && demoEvents > 0);

  const latestPublicEvents = latestRows.map((row: Record<string, unknown>) => ({
    occurredAt: String(row.created_at || ""),
    verdict: String(row.result || "UNKNOWN"),
    city: String(row.city || "Unknown"),
    country: String(row.country || "UNK"),
    tenant: String(row.tenant_slug || "tenant").slice(0, 24),
    uidMasked: maskUid(String(row.uid_hex || "")),
  }));

  const payload = {
    ok: true,
    tapsToday: Number(metrics.taps_today || 0),
    validRate,
    riskBlocked: Number(metrics.risk_blocked || 0),
    activeRegions: Number(metrics.active_regions || 0),
    latestPublicEvents,
    demoMode,
    generatedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, s-maxage=30, stale-while-revalidate=30",
    },
  });
}
