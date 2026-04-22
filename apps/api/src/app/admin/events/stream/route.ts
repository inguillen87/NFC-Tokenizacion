export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { onRealtimeEvent } from "../../../../lib/realtime-events";
import { randomUUID } from "node:crypto";

type EventRow = Record<string, unknown>;

function resolveWindow(search: URLSearchParams) {
  const raw = String(search.get("window") || "24h").toLowerCase();
  const map: Record<string, string> = {
    "5m": "5 minutes",
    "1h": "1 hour",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
    all: "",
  };
  return { raw, interval: map[raw] ?? "24 hours" };
}

function resolveWindowMs(raw: string): number | null {
  const map: Record<string, number> = {
    "5m": 5 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  return map[raw] ?? null;
}

async function fetchRows(search: URLSearchParams): Promise<EventRow[]> {
  const limit = Math.max(1, Math.min(200, Number(search.get("limit") || 40)));
  const tenant = String(search.get("tenant") || "").trim().toLowerCase();
  const verdict = String(search.get("verdict") || "").trim().toUpperCase();
  const risk = String(search.get("risk") || "").trim().toUpperCase();
  const { interval } = resolveWindow(search);
  const rows = tenant
    ? await sql/*sql*/`
        SELECT id, result, reason, uid_hex, created_at, city, country_code, lat, lng, bid, source,
               (SELECT slug FROM tenants t WHERE t.id = e.tenant_id LIMIT 1) AS tenant_slug
        FROM events e
        WHERE (SELECT slug FROM tenants t WHERE t.id = e.tenant_id LIMIT 1) = ${tenant}
          AND (${verdict} = '' OR UPPER(e.result) = ${verdict})
          AND (${risk} = '' OR UPPER(COALESCE(e.reason, '')) LIKE '%' || ${risk} || '%')
          AND (${interval} = '' OR e.created_at >= now() - ${interval}::interval)
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql/*sql*/`
        SELECT id, result, reason, uid_hex, created_at, city, country_code, lat, lng, bid, source,
               (SELECT slug FROM tenants t WHERE t.id = e.tenant_id LIMIT 1) AS tenant_slug
        FROM events e
        WHERE (${verdict} = '' OR UPPER(e.result) = ${verdict})
          AND (${risk} = '' OR UPPER(COALESCE(e.reason, '')) LIKE '%' || ${risk} || '%')
          AND (${interval} = '' OR e.created_at >= now() - ${interval}::interval)
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return Array.isArray(rows) ? rows : [];
}

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const requestId = req.headers.get("x-request-id") || req.headers.get("x-nexid-request-id") || randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const tenant = String(searchParams.get("tenant") || "").trim().toLowerCase();
      const verdict = String(searchParams.get("verdict") || "").trim().toUpperCase();
      const risk = String(searchParams.get("risk") || "").trim().toUpperCase();
      const { raw } = resolveWindow(searchParams);
      const windowMs = resolveWindowMs(raw);
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        const eventId = typeof payload === "object" && payload && "id" in (payload as Record<string, unknown>)
          ? String((payload as Record<string, unknown>).id)
          : String(Date.now());
        controller.enqueue(encoder.encode(`id: ${eventId}\n`));
        controller.enqueue(encoder.encode("retry: 5000\n"));
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        send("connected", { id: `connected-${Date.now()}`, requestId, ts: new Date().toISOString() });
        send("snapshot", { id: `snapshot-${Date.now()}`, requestId, rows: await fetchRows(searchParams) });
      } catch {
        send("warning", { id: `warning-${Date.now()}`, requestId, reason: "snapshot_unavailable" });
      }

      const unsubscribe = onRealtimeEvent((payload) => {
        if (tenant && String(payload.tenant_slug || "").toLowerCase() !== tenant) return;
        if (verdict && String(payload.result || "").toUpperCase() !== verdict) return;
        if (risk && !String(payload.reason || "").toUpperCase().includes(risk)) return;
        if (windowMs) {
          const createdAt = new Date(String(payload.created_at || Date.now()));
          if (Number.isNaN(createdAt.getTime())) return;
          const lowerBound = new Date(Date.now() - windowMs);
          if (createdAt < lowerBound) return;
        }
        const emittedAt = new Date();
        const createdAtMs = payload.created_at ? new Date(String(payload.created_at)).getTime() : NaN;
        const streamLatencyMs = Number.isFinite(createdAtMs) ? Math.max(0, emittedAt.getTime() - createdAtMs) : null;
        send("event", {
          ...payload,
          stream_sent_at: emittedAt.toISOString(),
          stream_latency_ms: streamLatencyMs,
          request_id: requestId,
        });
      });

      const heartbeat = setInterval(() => {
        const now = Date.now();
        controller.enqueue(encoder.encode(`: ping ${now}\n\n`));
        send("heartbeat", { id: `hb-${now}`, ts: now, requestId });
      }, 15000);

      const onAbort = () => shutdown();
      const shutdown = () => {
        clearInterval(heartbeat);
        unsubscribe();
        req.signal.removeEventListener("abort", onAbort);
        close();
      };

      setTimeout(() => {
        shutdown();
      }, 4 * 60 * 1000);

      req.signal.addEventListener("abort", onAbort, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-nexid-request-id": requestId,
    },
  });
}
