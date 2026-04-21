export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { onRealtimeEvent } from "../../../../lib/realtime-events";

type EventRow = Record<string, unknown>;

async function fetchRows(search: URLSearchParams): Promise<EventRow[]> {
  const limit = Math.max(1, Math.min(200, Number(search.get("limit") || 40)));
  const tenant = String(search.get("tenant") || "").trim().toLowerCase();
  const rows = tenant
    ? await sql/*sql*/`
        SELECT id, result, reason, uid_hex, created_at, city, country_code, lat, lng, bid, source,
               (SELECT slug FROM tenants t WHERE t.id = e.tenant_id LIMIT 1) AS tenant_slug
        FROM events e
        WHERE (SELECT slug FROM tenants t WHERE t.id = e.tenant_id LIMIT 1) = ${tenant}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql/*sql*/`
        SELECT id, result, reason, uid_hex, created_at, city, country_code, lat, lng, bid, source,
               (SELECT slug FROM tenants t WHERE t.id = e.tenant_id LIMIT 1) AS tenant_slug
        FROM events e
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return Array.isArray(rows) ? rows : [];
}

export async function GET(req: Request): Promise<Response> {
  const auth = checkAdmin(req);
  if (auth) return auth;

  const { searchParams } = new URL(req.url);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      send("snapshot", { rows: await fetchRows(searchParams) });

      const unsubscribe = onRealtimeEvent((payload) => {
        const tenant = String(searchParams.get("tenant") || "").trim().toLowerCase();
        if (tenant && String(payload.tenant_slug || "").toLowerCase() !== tenant) return;
        send("event", payload);
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
      }, 15000);

      setTimeout(() => {
        clearInterval(heartbeat);
        unsubscribe();
        close();
      }, 4 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
