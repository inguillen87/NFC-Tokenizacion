import { getDashboardSessionCredential, type DashboardSessionCredential } from "./session";
import { dashboardHighImpactPermissionMatches, dashboardPermissionMatches, dashboardPermissionDenied } from "./permission-policy";
import { supplierOperatorCan } from "./supplier-operator-access";
import { dashboardFetch } from "./dashboard-fetch";
import { productUrls } from "@product/config";

type Dependencies = { credential: () => Promise<DashboardSessionCredential | null>; fetcher: typeof fetch; apiBase: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
function result(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", Vary: "Cookie", "x-nexid-data-mode": "production" } }); }
export async function forwardSupplierRequest(req: Request, segments: string[] = [], dependencies: Dependencies = { credential: () => getDashboardSessionCredential({ persistRotation: true }), fetcher: dashboardFetch, apiBase: productUrls.api }) {
  const deny = (reason: string, status: number) => result({ ok: false, reason }, status);
  const url = new URL(req.url), write = req.method !== "GET";
  const assigned = segments[0] === "assigned", operators = segments.length === 1 && segments[0] === "operators";
  const resource = assigned ? segments.slice(1) : segments;
  const review = resource.length === 2 && resource[1] === "review", assignment = !assigned && resource.length === 2 && resource[1] === "assignment";
  const cancellation = !assigned && resource.length === 2 && resource[1] === "cancellation";
  const quotation = !assigned && resource.length === 2 && resource[1] === "quotation";
  const binding = !assigned && resource.length === 2 && resource[1] === "supplier-binding";
  const validResource = resource.length <= 2 && (!resource.length || UUID.test(resource[0])) && (resource.length !== 2 || (assigned ? review : ["submit", "review", "assignment", "cancellation", "quotation", "supplier-binding"].includes(resource[1])));
  const methodAllowed = operators ? req.method === "GET" : assigned ? review ? ["GET", "POST"].includes(req.method) : req.method === "GET" : review || assignment || cancellation || quotation || binding ? ["GET", "POST"].includes(req.method) : resource.length === 2 ? req.method === "POST" : resource.length === 1 ? ["GET", "PATCH"].includes(req.method) : ["GET", "POST"].includes(req.method);
  if ((!operators && !validResource) || !methodAllowed) return deny("supplier_request_method_invalid", 405);
  const before = url.searchParams.get("before_revision");
  if (url.searchParams.getAll("tenant").length > 1 || ((assigned || operators) && url.searchParams.has("tenant")) || url.searchParams.getAll("before_revision").length > 1 || [...url.searchParams.keys()].some(key => !(key === "tenant" && !operators && !assigned) && !((review || assignment || quotation || binding) && !write && key === "before_revision")) || (before !== null && (!/^[1-9]\d*$/.test(before) || !Number.isSafeInteger(Number(before)) || Number(before) > 2_147_483_646))) return deny("supplier_request_scope_forbidden", 400);
  if (write && (req.headers.get("origin") !== url.origin || (req.headers.has("sec-fetch-site") && req.headers.get("sec-fetch-site") !== "same-origin"))) return deny("supplier_request_origin_forbidden", 403);
  if (write && (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "") || !UUID.test(req.headers.get("idempotency-key") || ""))) return deny("supplier_request_body_invalid", 400);
  try {
    const credential = await dependencies.credential(), session = credential?.session;
    if (!session || !credential?.bearerToken) return deny("supplier_request_session_required", 401);
    if (binding && write && session.role !== "super-admin") return deny("supplier_binding_scope_forbidden", 403);
    if (session.isDemo) return deny("supplier_request_scope_forbidden", 403);
    if (assigned) {
      if (!supplierOperatorCan(session, "supplier_request.assigned.read") || (write && !supplierOperatorCan(session, "supplier_request.assigned.review"))) return deny("supplier_request_scope_forbidden", 403);
    } else if (session.role === "supplier-operator") return deny("supplier_request_scope_forbidden", 403);
    else if (assignment || operators) {
      if (session.role !== "super-admin" || !dashboardPermissionMatches(session.permissions, "supplier_request.assign", session.deniedPermissions) || dashboardPermissionDenied(session.deniedPermissions, "supplier_requests:assign")) return deny("supplier_request_scope_forbidden", 403);
    } else if (!dashboardHighImpactPermissionMatches(session.role, session.permissions, "supplier_order.create", session.deniedPermissions)) return deny("supplier_request_scope_forbidden", 403);
    const requested = (url.searchParams.get("tenant") || "").trim().toLowerCase(), bound = (session.tenantSlug || "").trim().toLowerCase();
    if (requested && !SLUG.test(requested)) return deny("supplier_request_scope_forbidden", 400);
    if (!assigned && session.role !== "super-admin" && (!bound || (requested && requested !== bound))) return deny("supplier_request_scope_forbidden", 403);
    const tenant = assigned || operators ? "" : session.role === "super-admin" ? requested : bound;
    if (tenant && !SLUG.test(tenant)) return deny("supplier_request_scope_forbidden", 400);
    if (!assigned && !operators && (write || segments.length) && !tenant) return deny("supplier_request_scope_forbidden", 400);
    let body: string | undefined;
    if (write) {
      const reader = req.body?.getReader(); if (!reader) return deny("supplier_request_body_invalid", 400);
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 32 * 1024) { await reader.cancel(); return deny("request_body_too_large", 413); } chunks.push(part.value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = new TextDecoder().decode(bytes);
      let parsed: unknown; try { parsed = JSON.parse(body); } catch { return deny("supplier_request_body_invalid", 400); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return deny("supplier_request_body_invalid", 400);
      if (quotation) {
        const action=(parsed as Record<string,unknown>).action;
        if(!["issue","accept","reject","withdraw"].includes(String(action)))return deny("supplier_quote_input_invalid",400);
        if(["issue","withdraw"].includes(String(action))!==(session.role==="super-admin"))return deny("supplier_quote_scope_forbidden",403);
      }
      if (review) {
        const action = (parsed as Record<string, unknown>).action;
        if (!["request_information", "respond"].includes(String(action))) return deny("supplier_request_body_invalid", 400);
        if (assigned || session.role === "super-admin" ? action !== "request_information" : action !== "respond") return deny("supplier_request_scope_forbidden", 403);
      }
    }
    const query = new URLSearchParams(); if (tenant) query.set("tenant", tenant); if (before !== null) query.set("before_revision", before);
    const target = `${dependencies.apiBase}/admin/supplier-requests${segments.length ? `/${segments.join("/")}` : ""}${query.size ? `?${query}` : ""}`;
    const upstream = await dependencies.fetcher(target, { method: req.method, cache: "no-store", headers: { authorization: `Bearer ${credential.bearerToken}`, Accept: "application/json", ...(write ? { "Content-Type": "application/json", "Idempotency-Key": req.headers.get("idempotency-key")! } : {}) }, body, signal: req.signal });
    const headers = new Headers({ "content-type": upstream.headers.get("content-type") || "application/json", "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer", Vary: "Cookie", "x-nexid-data-mode": "production" });
    if (upstream.headers.has("retry-after")) headers.set("retry-after", upstream.headers.get("retry-after")!);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch { return deny("supplier_request_unavailable", 503); }
}
