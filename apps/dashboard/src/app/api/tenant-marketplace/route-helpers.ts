import { productUrls } from "@product/config";
import { dashboardFetch } from "../../../lib/dashboard-fetch";
import { dashboardPermissionDenied, dashboardPermissionMatches } from "../../../lib/permission-policy";
import { resolveDashboardTenantScope } from "../../../lib/dashboard-tenant-scope-policy";
import { getDashboardSessionCredential, type DashboardSessionCredential } from "../../../lib/session";

type MarketplaceProxyDependencies = { credential: () => Promise<DashboardSessionCredential | null>; fetcher: typeof fetch; apiBase: string };
export const tenantMarketplaceNoStoreHeaders = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", Vary: "Cookie" };
const defaults = { credential: () => getDashboardSessionCredential({ persistRotation: true }), fetcher: dashboardFetch, apiBase: productUrls.api };
const MAX_BODY_BYTES = 24 * 1024;
function result(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...tenantMarketplaceNoStoreHeaders, "content-type": "application/json" } });
}
export function marketplaceMethodUnavailable() { return result({ ok: false, reason: "catalog_method_invalid" }, 405); }

/** A real credential reaches the API; no caller-supplied tenant/actor headers or demo stores. */
export async function forwardTenantMarketplace(req: Request, dependencies: MarketplaceProxyDependencies = defaults) {
  const deny = (reason: string, status: number) => result({ ok: false, reason }, status);
  const write = req.method === "POST", url = new URL(req.url);
  if (!["GET", "POST"].includes(req.method)) return marketplaceMethodUnavailable();
  const id = url.searchParams.get("id");
  if (url.searchParams.getAll("tenant").length > 1 || url.searchParams.getAll("id").length > 1 || [...url.searchParams.keys()].some(key => key !== "tenant" && key !== "id") || (id !== null && (write || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/.test(id)))) return deny("catalog_tenant_invalid", 400);
  if (write && (req.headers.get("origin") !== url.origin || (req.headers.has("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin"))) return deny("catalog_same_origin_required", 403);
  if (write && !/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) return deny("catalog_json_required", 415);
  try {
    const credential = await dependencies.credential(), session = credential?.session;
    if (!session || !credential?.bearerToken) return deny("catalog_session_required", 401);
    if (session.isDemo) return deny("catalog_demo_unavailable", 403);
    const permission = write ? "marketplace:write" : "marketplace:read";
    const roles = write ? ["super-admin", "tenant-owner", "tenant-admin"] : ["super-admin", "tenant-owner", "tenant-admin", "marketing-manager"];
    const allowed = roles.includes(session.role) && (session.role === "super-admin"
      ? !dashboardPermissionDenied(session.deniedPermissions, permission)
      : dashboardPermissionMatches(session.permissions, permission, session.deniedPermissions));
    if (!allowed) return deny("catalog_forbidden", 403);
    const requested = url.searchParams.get("tenant");
    if (session.role !== "super-admin" && requested && requested.trim().toLowerCase() !== session.tenantSlug?.trim().toLowerCase()) return deny("catalog_tenant_forbidden", 403);
    let tenant: string;
    try { tenant = resolveDashboardTenantScope(session, requested).tenantSlug; }
    catch { return deny("catalog_tenant_required", 400); }
    if (!tenant) return deny("catalog_tenant_required", 400);
    let body: string | undefined;
    if (write) {
      const declared = Number(req.headers.get("content-length") || 0);
      if (declared > MAX_BODY_BYTES) return deny("catalog_body_too_large", 413);
      const reader = req.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
      if (!reader) return deny("catalog_invalid", 400);
      while (true) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_BODY_BYTES) { await reader.cancel(); return deny("catalog_body_too_large", 413); }
        chunks.push(part.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = new TextDecoder().decode(bytes);
      let parsed: unknown; try { parsed = JSON.parse(body); } catch { return deny("catalog_invalid", 400); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return deny("catalog_invalid", 400);
    }
    const query = new URLSearchParams({ tenant });
    if (id) query.set("id", id);
    const target = `${dependencies.apiBase}/admin/consumer-network/catalog?${query}`;
    const upstream = await dependencies.fetcher(target, {
      method: req.method, cache: "no-store", signal: req.signal, body,
      headers: { authorization: `Bearer ${credential.bearerToken}`, Accept: "application/json", ...(write ? { "content-type": "application/json" } : {}) },
    });
    const headers = new Headers({ ...tenantMarketplaceNoStoreHeaders, "content-type": "application/json", "x-nexid-data-mode": "production" });
    if (upstream.headers.has("retry-after")) headers.set("retry-after", upstream.headers.get("retry-after")!);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch { return deny("catalog_unavailable", 503); }
}
