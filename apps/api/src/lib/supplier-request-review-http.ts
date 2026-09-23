import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { sql } from "./db";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { SupplierRequestError, parseSupplierRequestId, parseSupplierRequestIdempotencyKey } from "./supplier-request-contract";
import { resolveSupplierRequestScope } from "./supplier-request-store";
import { SUPPLIER_REQUEST_REVIEW_PROTOCOL, SUPPLIER_REQUEST_REVIEW_MAX_BODY_BYTES, parseSupplierRequestReviewCommand, parseSupplierRequestReviewQuery, supplierRequestReviewFromRow } from "./supplier-request-review-contract";

const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql };
const headers = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
export function makeSupplierRequestReviewHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, rawId: string, write: boolean) {
    try {
      const auth = await deps.authorize(req, "supplier_order.create");
      if (auth) {
        const result = json({ ok: false, protocol: SUPPLIER_REQUEST_REVIEW_PROTOCOL, reason: auth.status === 401 ? "supplier_request_unauthorized" : auth.status === 403 ? "supplier_request_review_scope_forbidden" : "supplier_request_reviews_unavailable" }, auth.status);
        for (const name of ["retry-after", "x-nexid-auth-outcome"]) { const value = auth.headers.get(name); if (value) result.headers.set(name, value); }
        return result;
      }
      const principal = deps.principal(req), params = parseSupplierRequestReviewQuery(new URL(req.url).searchParams, !write);
      const id = parseSupplierRequestId(rawId), scope = await resolveSupplierRequestScope(params.tenant, principal, false, deps.query);
      let row: Record<string, unknown> | undefined;
      let command: ReturnType<typeof parseSupplierRequestReviewCommand> | undefined, key: string | undefined;
      if (write) {
        key = parseSupplierRequestIdempotencyKey(req.headers.get("idempotency-key"));
        if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new SupplierRequestError("supplier_request_review_body_invalid", 415);
        let raw: unknown;
        try { raw = await readBoundedJsonBody<unknown>(req, SUPPLIER_REQUEST_REVIEW_MAX_BODY_BYTES); }
        catch (error) { throw new SupplierRequestError(error instanceof RequestBodyTooLargeError ? "supplier_request_review_body_too_large" : "supplier_request_review_body_invalid", error instanceof RequestBodyTooLargeError ? 413 : 400); }
        command = parseSupplierRequestReviewCommand(raw);
        if ((command.action === "request_information") !== (principal.scope === "super_admin")) throw new SupplierRequestError("supplier_request_review_scope_forbidden", 403);
        const input = { ...command, tenant_id: scope.tenant_id, actor_id: parseSupplierRequestId(principal.userId), auth_session_id: parseSupplierRequestId(principal.sessionId), request_id: id, idempotency_key: key };
        [row] = await deps.query`SELECT public.nexid_mutate_supplier_request_review_v1(${JSON.stringify(input)}::jsonb) AS result`;
      } else {
        [row] = await deps.query`SELECT public.nexid_supplier_request_review_current_v1(${id}::uuid,${scope.tenant_id}::uuid,${params.before}::integer) AS result`;
      }
      const raw = row?.result as Record<string, unknown> | undefined;
      if (!raw && !write) throw new SupplierRequestError("supplier_request_not_found", 404);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("supplier_request_review_record_invalid");
      if (write && raw.ok !== true) {
        const reason = String(raw.reason || "");
        const codes: Record<string, number> = { supplier_request_review_scope_forbidden: 403, supplier_request_not_found: 404, supplier_request_not_submitted: 409,
          supplier_request_revision_conflict: 409, supplier_request_review_revision_conflict: 409, supplier_request_review_idempotency_conflict: 409, supplier_request_review_transition_invalid: 409 };
        if (!Object.hasOwn(codes, reason)) throw Error("supplier_request_review_record_invalid");
        throw new SupplierRequestError(reason, codes[reason]);
      }
      if (raw.tenant_id !== scope.tenant_id || raw.tenant_slug !== scope.tenant_slug) throw Error("supplier_request_review_scope_invalid");
      const data = supplierRequestReviewFromRow(raw, params.before);
      if (data.request_id !== id) throw Error("supplier_request_review_scope_invalid");
      const base = { ok: true, protocol: SUPPLIER_REQUEST_REVIEW_PROTOCOL, scope, ...data };
      if (!write) return json(base);
      const receipt = raw.receipt as Record<string, unknown> | undefined;
      if (typeof raw.idempotent_replay !== "boolean" || !receipt || receipt.idempotency_key !== key || receipt.action !== command!.action
        || receipt.revision !== command!.expected_revision + 1 || Number(receipt.revision) > data.review.revision
        || data.request_revision < command!.expected_request_revision
        || (!raw.idempotent_replay && (receipt.revision !== data.review.revision || data.request_revision !== command!.expected_request_revision))) throw Error("supplier_request_review_receipt_invalid");
      return json({ ...base, idempotent_replay: raw.idempotent_replay, receipt: { idempotency_key: key, action: command!.action, revision: receipt.revision } });
    } catch (error) {
      if (error instanceof SupplierRequestError) return json({ ok: false, protocol: SUPPLIER_REQUEST_REVIEW_PROTOCOL, reason: error.message }, error.status);
      return json({ ok: false, protocol: SUPPLIER_REQUEST_REVIEW_PROTOCOL, reason: "supplier_request_reviews_unavailable" }, 503);
    }
  }
  return { get: (req: Request, id: string) => handle(req, id, false), post: (req: Request, id: string) => handle(req, id, true) };
}
