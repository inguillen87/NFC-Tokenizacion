import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { sql } from "./db";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { SupplierRequestError, parseSupplierRequestId, parseSupplierRequestIdempotencyKey, parseSupplierRequestQuery, supplierRequestFromRow } from "./supplier-request-contract";
import { getSupplierRequest, resolveSupplierRequestScope } from "./supplier-request-store";
import { SUPPLIER_REQUEST_CANCELLATION_PROTOCOL as protocol, SUPPLIER_REQUEST_CANCELLATION_MAX_BYTES, parseSupplierRequestCancellation } from "./supplier-request-cancellation-contract";
const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql, enabled: () => process.env.SUPPLIER_REQUEST_CANCELLATION_ENABLED === "true" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer" } });
export function makeSupplierRequestCancellationHandlers(overrides: Partial<typeof defaults> = {}) {
 const deps = { ...defaults, ...overrides };
 async function handle(req: Request, rawId: string, write: boolean) {
  try {
   const auth = await deps.authorize(req, "supplier_order.create");
   if (auth) {
    const response = json({ ok: false, protocol, reason: auth.status === 401 ? "supplier_request_unauthorized" : auth.status === 403 ? "supplier_request_scope_forbidden" : "supplier_request_cancellation_unavailable" }, auth.status);
    for (const name of ["retry-after", "x-nexid-auth-outcome"]) { const value = auth.headers.get(name); if (value) response.headers.set(name, value); }
    return response;
   }
   if (!deps.enabled()) throw new SupplierRequestError("supplier_request_cancellation_disabled", 503);
   const principal = deps.principal(req), id = parseSupplierRequestId(rawId), params = parseSupplierRequestQuery(new URL(req.url).searchParams, false);
   const scope = await resolveSupplierRequestScope(params.tenant, principal, false, deps.query);
   const [capability] = await deps.query`SELECT to_regprocedure('public.nexid_cancel_supplier_request_v1(jsonb)') IS NOT NULL
    AND COALESCE(has_function_privilege(current_user,to_regprocedure('public.nexid_cancel_supplier_request_v1(jsonb)'),'EXECUTE'),false) AS available`;
   if (capability?.available !== true) throw new SupplierRequestError("supplier_request_cancellation_unavailable", 503);
   if (!write) return json({ ok: true, protocol, scope, available: true, request: await getSupplierRequest(scope, id, deps.query) });
   const key = parseSupplierRequestIdempotencyKey(req.headers.get("idempotency-key"));
   if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) throw new SupplierRequestError("supplier_request_body_invalid", 415);
   let raw: unknown;
   try { raw = await readBoundedJsonBody(req, SUPPLIER_REQUEST_CANCELLATION_MAX_BYTES); }
   catch (error) { throw new SupplierRequestError(error instanceof RequestBodyTooLargeError ? "supplier_request_body_too_large" : "supplier_request_body_invalid", error instanceof RequestBodyTooLargeError ? 413 : 400); }
   const command = parseSupplierRequestCancellation(raw);
   const input = { ...command, tenant_id: scope.tenant_id, request_id: id, actor_id: parseSupplierRequestId(principal.userId), auth_session_id: parseSupplierRequestId(principal.sessionId), idempotency_key: key };
   const [row] = await deps.query`SELECT public.nexid_cancel_supplier_request_v1(${JSON.stringify(input)}::jsonb) AS result`;
   const result = row?.result as Record<string, any> | undefined;
   if (!result || typeof result !== "object" || Array.isArray(result)) throw Error();
   if (result.ok !== true) {
    const codes: Record<string, number> = { supplier_request_not_found: 404, supplier_request_scope_forbidden: 403, supplier_request_idempotency_conflict: 409, supplier_request_revision_conflict: 409, supplier_request_review_revision_conflict: 409, supplier_request_cancellation_not_submitted: 409 };
    if (!Object.hasOwn(codes, result.reason)) throw Error();
    throw new SupplierRequestError(result.reason, codes[result.reason]);
   }
   const item = supplierRequestFromRow(result.request), receipt = result.receipt;
   if (item.id !== id || item.tenant_id !== scope.tenant_id || item.tenant_slug !== scope.tenant_slug || item.status !== "cancelled"
    || item.review_summary.revision !== command.expected_review_revision || item.revision !== command.expected_revision + 1 || item.cancellation_reason !== command.reason || item.cancelled_by !== input.actor_id
    || typeof result.idempotent_replay !== "boolean" || !receipt || receipt.idempotency_key !== key || receipt.action !== "cancel" || receipt.revision !== item.revision) throw Error();
   return json({ ok: true, protocol, scope, available: true, request: item, receipt: { idempotency_key: key, action: "cancel", revision: item.revision }, idempotent_replay: result.idempotent_replay });
  } catch (error) {
   if (error instanceof SupplierRequestError) return json({ ok: false, protocol, reason: error.message }, error.status);
   return json({ ok: false, protocol, reason: "supplier_request_cancellation_unavailable" }, 503);
  }
 }
 return { get: (req: Request, id: string) => handle(req, id, false), post: (req: Request, id: string) => handle(req, id, true) };
}
