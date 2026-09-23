import { getDashboardSessionCredential, type DashboardSessionCredential } from "./session";
import { dashboardHighImpactPermissionMatches } from "./permission-policy";
import { dashboardFetch } from "./dashboard-fetch";
import { productUrls } from "@product/config";

type Dependencies = { credential: () => Promise<DashboardSessionCredential | null>; fetcher: typeof fetch; apiBase: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
function result(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", Vary: "Cookie", "x-nexid-data-mode": "production" } }); }
export async function forwardSupplierRequest(req: Request, segments: string[] = [], dependencies: Dependencies = { credential: () => getDashboardSessionCredential({ persistRotation: true }), fetcher: dashboardFetch, apiBase: productUrls.api }) {
  const deny = (reason: string, status: number) => result({ ok: false, reason }, status);
  const url = new URL(req.url), write = req.method !== "GET";
  if (segments.length > 2 || (segments.length && !UUID.test(segments[0])) || (segments.length === 2 && segments[1] !== "submit") || !(segments.length === 2 ? req.method === "POST" : segments.length === 1 ? ["GET", "PATCH"].includes(req.method) : ["GET", "POST"].includes(req.method))) return deny("supplier_request_method_invalid", 405);
  if (url.searchParams.getAll("tenant").length > 1 || [...url.searchParams.keys()].some(key => key !== "tenant")) return deny("supplier_request_scope_forbidden", 400);
  if (write && (req.headers.get("origin") !== url.origin || (req.headers.has("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin"))) return deny("supplier_request_origin_forbidden", 403);
  if (write && (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "") || !UUID.test(req.headers.get("idempotency-key") || ""))) return deny("supplier_request_body_invalid", 400);
  try {
    const credential = await dependencies.credential(), session = credential?.session;
    if (!session || !credential?.bearerToken) return deny("supplier_request_session_required", 401);
    if (session.isDemo || !dashboardHighImpactPermissionMatches(session.role, session.permissions, "supplier_order.create", session.deniedPermissions)) return deny("supplier_request_scope_forbidden", 403);
    const requested = (url.searchParams.get("tenant") || "").trim().toLowerCase(), bound = (session.tenantSlug || "").trim().toLowerCase();
    if (requested && !SLUG.test(requested)) return deny("supplier_request_scope_forbidden", 400);
    if (session.role !== "super-admin" && (!bound || (requested && requested !== bound))) return deny("supplier_request_scope_forbidden", 403);
    const tenant = session.role === "super-admin" ? requested : bound;
    if (tenant && !SLUG.test(tenant)) return deny("supplier_request_scope_forbidden", 400);
    if ((write || segments.length) && !tenant) return deny("supplier_request_scope_forbidden", 400);
    let body: string | undefined;
    if (write) {
      const reader = req.body?.getReader(); if (!reader) return deny("supplier_request_body_invalid", 400);
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 32 * 1024) { await reader.cancel(); return deny("request_body_too_large", 413); } chunks.push(part.value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = new TextDecoder().decode(bytes);
      let parsed: unknown; try { parsed = JSON.parse(body); } catch { return deny("supplier_request_body_invalid", 400); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return deny("supplier_request_body_invalid", 400);
    }
    const target = `${dependencies.apiBase}/admin/supplier-requests${segments.length ? `/${segments.join("/")}` : ""}${tenant ? `?tenant=${encodeURIComponent(tenant)}` : ""}`;
    const upstream = await dependencies.fetcher(target, { method: req.method, cache: "no-store", headers: { authorization: `Bearer ${credential.bearerToken}`, Accept: "application/json", ...(write ? { "Content-Type": "application/json", "Idempotency-Key": req.headers.get("idempotency-key")! } : {}) }, body, signal: req.signal });
    const headers = new Headers({ "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", Vary: "Cookie", "x-nexid-data-mode": "production" });
    if (upstream.headers.has("retry-after")) headers.set("retry-after", upstream.headers.get("retry-after")!);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch { return deny("supplier_request_unavailable", 503); }
}
