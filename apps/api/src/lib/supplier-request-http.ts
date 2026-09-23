import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { sql } from "./db";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { SupplierRequestError, SUPPLIER_REQUEST_PROTOCOL, SUPPLIER_REQUEST_MAX_BODY_BYTES, parseSupplierRequestCreate, parseSupplierRequestPatch, parseSupplierRequestSubmit, parseSupplierRequestId, parseSupplierRequestIdempotencyKey, parseSupplierRequestQuery } from "./supplier-request-contract";
import { resolveSupplierRequestScope, listSupplierRequests, getSupplierRequest, mutateSupplierRequest } from "./supplier-request-store";

const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql };
const HEADERS = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: HEADERS });
async function body(req: Request) {
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new SupplierRequestError("supplier_request_body_invalid", 415);
  try { return await readBoundedJsonBody<unknown>(req, SUPPLIER_REQUEST_MAX_BODY_BYTES); }
  catch (error) { throw new SupplierRequestError(error instanceof RequestBodyTooLargeError ? "supplier_request_body_too_large" : "supplier_request_body_invalid", error instanceof RequestBodyTooLargeError ? 413 : 400); }
}
export function makeSupplierRequestHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, action: "list" | "get" | "create" | "patch" | "submit", rawId?: string) {
    try {
      const auth = await deps.authorize(req, "supplier_order.create");
      if (auth) {
        const response = json({ ok: false, protocol: SUPPLIER_REQUEST_PROTOCOL, reason: auth.status === 401 ? "supplier_request_unauthorized" : auth.status === 403 ? "supplier_request_scope_forbidden" : "supplier_requests_unavailable" }, auth.status);
        for (const key of ["retry-after", "x-nexid-auth-outcome"]) { const value = auth.headers.get(key); if (value) response.headers.set(key, value); }
        return response;
      }
      const principal = deps.principal(req), url = new URL(req.url);
      const params = parseSupplierRequestQuery(url.searchParams, action === "list");
      const scope = await resolveSupplierRequestScope(params.tenant, principal, action === "list", deps.query);
      const base = { ok: true, protocol: SUPPLIER_REQUEST_PROTOCOL, scope };
      if (action === "list") return json({ ...base, ...await listSupplierRequests(scope, params.options!, deps.query) });
      const id = action === "create" ? null : parseSupplierRequestId(rawId);
      if (action === "get") return json({ ...base, request: await getSupplierRequest(scope, id!, deps.query) });
      const key = parseSupplierRequestIdempotencyKey(req.headers.get("idempotency-key"));
      const raw = await body(req);
      const parsed = action === "create" ? parseSupplierRequestCreate(raw) : action === "patch" ? parseSupplierRequestPatch(raw) : parseSupplierRequestSubmit(raw);
      const expectedRevision = "expected_revision" in parsed ? parsed.expected_revision : null;
      const content = action === "submit" ? null : parseSupplierRequestCreate(Object.fromEntries(["title", "construction_id", "quantity", "pack_purpose", "notes"].map(key => [key, (parsed as unknown as Record<string, unknown>)[key]])));
      const result = await mutateSupplierRequest(scope, principal, action, id, key, expectedRevision, content, deps.query);
      return json({ ...base, ...result }, action === "create" && !result.idempotent_replay ? 201 : 200);
    } catch (error) {
      if (error instanceof SupplierRequestError) return json({ ok: false, protocol: SUPPLIER_REQUEST_PROTOCOL, reason: error.message, ...error.details }, error.status);
      return json({ ok: false, protocol: SUPPLIER_REQUEST_PROTOCOL, reason: "supplier_requests_unavailable" }, 503);
    }
  }
  return { list: (req: Request) => handle(req, "list"), create: (req: Request) => handle(req, "create"), get: (req: Request, id: string) => handle(req, "get", id), patch: (req: Request, id: string) => handle(req, "patch", id), submit: (req: Request, id: string) => handle(req, "submit", id) };
}
