export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

type CountRow = { total?: number; latest?: string | null; replay?: number; risk?: number };

export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const tenant = String(searchParams.get("tenant") || "").trim().toLowerCase();

  const eventRows = tenant
    ? await sql/*sql*/`
        SELECT
          COUNT(e.id)::int AS total,
          MAX(e.created_at)::text AS latest,
          COUNT(*) FILTER (WHERE e.result IN ('REPLAY_SUSPECT', 'DUPLICATE'))::int AS replay,
          COUNT(*) FILTER (WHERE e.result IN ('INVALID', 'TAMPER', 'NOT_REGISTERED', 'NOT_ACTIVE'))::int AS risk
        FROM events e
        JOIN tenants t ON t.id = e.tenant_id
        WHERE t.slug = ${tenant}
      `
    : await sql/*sql*/`
        SELECT
          COUNT(id)::int AS total,
          MAX(created_at)::text AS latest,
          COUNT(*) FILTER (WHERE result IN ('REPLAY_SUSPECT', 'DUPLICATE'))::int AS replay,
          COUNT(*) FILTER (WHERE result IN ('INVALID', 'TAMPER', 'NOT_REGISTERED', 'NOT_ACTIVE'))::int AS risk
        FROM events
      `;

  const throughputRows = tenant
    ? await sql/*sql*/`
        SELECT
          COUNT(*) FILTER (WHERE e.created_at >= now() - interval '1 minute')::int AS events_1m,
          COUNT(*) FILTER (WHERE e.created_at >= now() - interval '5 minutes')::int AS events_5m
        FROM events e
        JOIN tenants t ON t.id = e.tenant_id
        WHERE t.slug = ${tenant}
      `
    : await sql/*sql*/`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= now() - interval '1 minute')::int AS events_1m,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '5 minutes')::int AS events_5m
        FROM events
      `;

  let attemptRows: CountRow[] = [];
  try {
    attemptRows = tenant
      ? await sql/*sql*/`
          SELECT
            COUNT(a.id)::int AS total,
            MAX(a.created_at)::text AS latest
          FROM sun_scan_attempts a
          WHERE (${tenant} = '' OR (${tenant} = 'demobodega' AND a.bid ILIKE 'DEMO-%'))
        `
      : await sql/*sql*/`
          SELECT COUNT(id)::int AS total, MAX(created_at)::text AS latest
          FROM sun_scan_attempts
        `;
  } catch {
    attemptRows = [{ total: 0, latest: null }];
  }

  const events = (eventRows?.[0] || {}) as CountRow;
  const throughput = (throughputRows?.[0] || {}) as { events_1m?: number; events_5m?: number };
  const attempts = (attemptRows?.[0] || {}) as CountRow;
  const latestEventAt = events.latest ? new Date(events.latest) : null;
  const latestAttemptAt = attempts.latest ? new Date(attempts.latest) : null;
  const latestAt = latestEventAt && latestAttemptAt
    ? new Date(Math.max(latestEventAt.getTime(), latestAttemptAt.getTime()))
    : latestEventAt || latestAttemptAt;

  const now = Date.now();
  const freshnessMs = latestAt ? Math.max(0, now - latestAt.getTime()) : null;
  const streamState = freshnessMs == null
    ? "no_data"
    : freshnessMs < 30_000
      ? "live"
      : freshnessMs < 120_000
        ? "stale"
        : "delayed";

  return json({
    ok: true,
    scope: { tenant: tenant || "global" },
    counters: {
      eventsTotal: Number(events.total || 0),
      events1m: Number(throughput.events_1m || 0),
      events5m: Number(throughput.events_5m || 0),
      replayEvents: Number(events.replay || 0),
      riskEvents: Number(events.risk || 0),
      unassignedAttempts: Number(attempts.total || 0),
    },
    freshness: {
      latestEventAt: events.latest || null,
      latestAttemptAt: attempts.latest || null,
      latestAt: latestAt ? latestAt.toISOString() : null,
      ageMs: freshnessMs,
      streamState,
    },
    generatedAt: new Date(now).toISOString(),
  });
}
