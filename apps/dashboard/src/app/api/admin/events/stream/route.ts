export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { randomUUID } from "node:crypto";
import { getDashboardSession } from "../../../../../lib/session";
import { getDashboardDemoEvents, toDemoRealtimeEvent } from "../../../../../lib/demo-runtime-state";
import { DashboardTenantScopeError, resolveDashboardTenantScope } from "../../../../../lib/dashboard-tenant-scope-policy";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const DASHBOARD_STREAM_SOURCES = ["production", "demo", "all", "real", "imported"] as const;
type DashboardStreamSource = (typeof DASHBOARD_STREAM_SOURCES)[number];

function parseDashboardStreamSource(value: unknown): DashboardStreamSource | null {
  const normalized = String(value || "production").trim().toLowerCase();
  return DASHBOARD_STREAM_SOURCES.includes(normalized as DashboardStreamSource)
    ? normalized as DashboardStreamSource
    : null;
}

function fallbackStream(
  message: string,
  requestId: string,
  limit = 8,
  options: { includeDemoRows?: boolean; tenant?: string; source?: DashboardStreamSource; availability?: "fallback" | "upstream_error" } = {},
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
        enqueue(`event: snapshot\ndata: ${JSON.stringify({ rows, source: options.source || "production", availability: options.availability || "upstream_error" })}\n\n`);
      };
      pushSnapshot();
      enqueue(`event: warning\ndata: ${JSON.stringify({ reason: message, requestId, source: options.source || "production", availability: options.availability || "upstream_error" })}\n\n`);
      heartbeat = setInterval(() => {
        const now = Date.now();
        enqueue(`: ping ${now}\n\n`);
        pushSnapshot();
        enqueue(`event: heartbeat\ndata: ${JSON.stringify({ id: `hb-${now}`, ts: now, requestId, source: options.source || "production", availability: options.availability || "upstream_error" })}\n\n`);
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
  const requestedSource = parseDashboardStreamSource(incoming.searchParams.get("source"));
  if (!requestedSource) {
    return new Response(JSON.stringify({ ok: false, reason: "invalid_source_filter", allowed: DASHBOARD_STREAM_SOURCES }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

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

  if (isProduction && !session) return fallbackStream("Dashboard session required", requestId, limit, { source: requestedSource });

  let tenant = requestedTenant;
  if (session) {
    try {
      tenant = resolveDashboardTenantScope(session, requestedTenant).tenantSlug;
    } catch (error) {
      if (error instanceof DashboardTenantScopeError) {
        return fallbackStream(error.code, requestId, limit, { source: requestedSource });
      }
      throw error;
    }
  }
  incoming.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));
  upstream.searchParams.delete("tenant");
  if (tenant) upstream.searchParams.set("tenant", tenant);
  const effectiveSource: DashboardStreamSource = forceSandbox ? "demo" : requestedSource;
  upstream.searchParams.set("source", effectiveSource);

  if (forceSandbox && (!isProduction || Boolean(scopedRole)) && scopedRole !== "tenant_admin") {
    return fallbackStream("dashboard demo sandbox stream", requestId, limit, { includeDemoRows: true, tenant, source: "demo", availability: "fallback" });
  }

  if (requireScopedAdminAuth && !scopedRole) return fallbackStream("Scoped admin auth required", requestId, limit, { tenant, source: effectiveSource });
  if (!token && !scopedRole) return fallbackStream("ADMIN_API_KEY missing in dashboard environment", requestId, limit, { tenant, source: effectiveSource });

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
    const includeDemoRows = effectiveSource === "demo";
    return fallbackStream(`upstream stream unavailable (${response?.status || 503})`, requestId, limit, {
      tenant,
      source: effectiveSource,
      includeDemoRows,
      availability: includeDemoRows ? "fallback" : "upstream_error",
    });
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
