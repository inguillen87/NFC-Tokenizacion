import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { DashboardSession } from "./session";
import { getServerOrigin } from "./server-origin";
import {
  DashboardTenantScopeError,
  resolveDashboardTenantScope,
  type DashboardTenantScope,
} from "./dashboard-tenant-scope-policy";

export type AdminPageContext = DashboardTenantScope & {
  origin: string;
  cookie: string;
};

export function requireDashboardTenantScope(
  session: DashboardSession,
  requestedTenant?: unknown,
): DashboardTenantScope {
  try {
    return resolveDashboardTenantScope(session, requestedTenant);
  } catch (error) {
    if (error instanceof DashboardTenantScopeError) notFound();
    throw error;
  }
}

export async function createAdminPageContext(
  session: DashboardSession,
  requestedTenant?: unknown,
): Promise<AdminPageContext> {
  const scope = requireDashboardTenantScope(session, requestedTenant);
  const [origin, requestHeaders] = await Promise.all([getServerOrigin(), headers()]);
  return {
    ...scope,
    origin,
    cookie: requestHeaders.get("cookie") || "",
  };
}

function normalizeAdminPath(path: string) {
  return String(path || "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/api\/admin\/?/i, "")
    .replace(/^\/admin\/?/i, "")
    .replace(/^\/+/, "");
}

export function buildAdminBffUrl(context: AdminPageContext, path: string) {
  const normalizedPath = normalizeAdminPath(path);
  const [pathname, rawQuery = ""] = normalizedPath.split("?", 2);
  const url = new URL(`/api/admin/${pathname}`, context.origin);
  const incoming = new URLSearchParams(rawQuery);
  incoming.delete("tenant");
  for (const [key, value] of incoming) url.searchParams.append(key, value);
  if (context.tenantSlug) url.searchParams.set("tenant", context.tenantSlug);
  return url;
}

export async function fetchAdminPage(
  context: AdminPageContext,
  path: string,
  init: RequestInit = {},
) {
  const requestHeaders = new Headers(init.headers || {});
  if (context.cookie) requestHeaders.set("cookie", context.cookie);
  if (init.body && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }
  return fetch(buildAdminBffUrl(context, path), {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });
}
