export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getDashboardSession } from "../../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

function fallbackStream(message: string, requestId: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: snapshot\ndata: {"rows":[]}\n\n'));
      controller.enqueue(encoder.encode(`event: warning\ndata: ${JSON.stringify({ reason: message, requestId })}\n\n`));
      const heartbeat = setInterval(() => {
        const now = Date.now();
        controller.enqueue(encoder.encode(`: ping ${now}\n\n`));
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ id: `hb-${now}`, ts: now, requestId })}\n\n`));
      }, 15000);
      setTimeout(() => {
        clearInterval(heartbeat);
        controller.close();
      }, 60 * 1000);
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

  if (requireScopedAdminAuth && !scopedRole) return fallbackStream("Scoped admin auth required", requestId);
  if (!token && !scopedRole) return fallbackStream("ADMIN_API_KEY missing in dashboard environment", requestId);

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
    return fallbackStream(`upstream stream unavailable (${response?.status || 503})`, requestId);
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
