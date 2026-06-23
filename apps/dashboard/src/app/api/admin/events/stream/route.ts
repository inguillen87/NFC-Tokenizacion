export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getDashboardSession } from "../../../../../lib/session";
import { getDashboardDemoEvents, toDemoRealtimeEvent } from "../../../../../lib/demo-runtime-state";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function fallbackStream(
  message: string,
  requestId: string,
  limit = 8,
  options: { includeDemoRows?: boolean; tenant?: string } = {},
) {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  const cleanup = () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  };
  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const pushSnapshot = () => {
        const tenant = String(options.tenant || "").toLowerCase();
        const rows = options.includeDemoRows
          ? getDashboardDemoEvents(limit)
            .filter((row) => !tenant || row.tenant_slug === tenant)
            .map(toDemoRealtimeEvent)
          : [];
        enqueue(`event: snapshot\ndata: ${JSON.stringify({ rows })}\n\n`);
      };
      pushSnapshot();
      enqueue(`event: warning\ndata: ${JSON.stringify({ reason: message, requestId })}\n\n`);
      heartbeat = setInterval(() => {
        const now = Date.now();
        enqueue(`: ping ${now}\n\n`);
        pushSnapshot();
        enqueue(`event: heartbeat\ndata: ${JSON.stringify({ id: `hb-${now}`, ts: now, requestId })}\n\n`);
      }, 5000);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-nexid-request-id": requestId,
    },
  });
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${API_BASE}/admin/events/stream`);
  const requestId = request.headers.get("x-request-id") || request.headers.get("x-nexid-request-id") || randomUUID();
  const limit = Math.min(Math.max(Number(incoming.searchParams.get("limit") || 8), 1), 50);
  const forceSandbox = ["1", "true", "sandbox"].includes(String(incoming.searchParams.get("sandbox") || incoming.searchParams.get("demoFallback") || "").toLowerCase());
  const requestedTenant = String(incoming.searchParams.get("tenant") || "").trim().toLowerCase();
  incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  const token = String(process.env.ADMIN_API_KEY || "").trim();
  const requireScopedAdminAuth = String(process.env.REQUIRE_SCOPED_ADMIN_AUTH || "").toLowerCase() === "true";
  const session = await getDashboardSession().catch(() => null);
  const scopedRole = session?.role === "super-admin"
    ? "super_admin"
    : session?.role === "tenant-admin"
      ? "tenant_admin"
      : session?.role === "reseller"
        ? "reseller"
        : session?.role
          ? "readonly_demo"
          : "";
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";

  const tenant = requestedTenant || String(session?.tenantSlug || "").trim().toLowerCase();

  if (forceSandbox && (!isProduction || Boolean(scopedRole)) && scopedRole !== "tenant_admin") {
    return fallbackStream("dashboard demo sandbox stream", requestId, limit, { includeDemoRows: true, tenant });
  }

  if (requireScopedAdminAuth && !scopedRole) return fallbackStream("Scoped admin auth required", requestId, limit, { tenant });
  if (!token && !scopedRole) return fallbackStream("ADMIN_API_KEY missing in dashboard environment", requestId, limit, { tenant });

  const response = await fetch(upstream.toString(), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(scopedRole ? { "x-nexid-admin-scope": scopedRole } : {}),
      ...(session?.tenantSlug ? { "x-nexid-tenant-slug": session.tenantSlug } : {}),
      Accept: "text/event-stream",
      "x-nexid-request-id": requestId,
      ...(request.headers.get("last-event-id") ? { "Last-Event-ID": String(request.headers.get("last-event-id")) } : {}),
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response?.ok || !response.body) {
    return fallbackStream(`upstream stream unavailable (${response?.status || 503})`, requestId, limit, { tenant });
  }

  return new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-nexid-request-id": response.headers.get("x-nexid-request-id") || requestId,
    },
  });
}
