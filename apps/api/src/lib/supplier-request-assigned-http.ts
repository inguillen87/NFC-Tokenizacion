import { checkAdmin, checkAdminPermission, getAdminPrincipal, type AdminSessionResolver } from "./auth";
import { sql } from "./db";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { SupplierRequestError, SUPPLIER_REQUEST_PROTOCOL, SUPPLIER_REQUEST_TENANT_SLUG, parseSupplierRequestId, parseSupplierRequestIdempotencyKey, supplierRequestFromRow } from "./supplier-request-contract";
import { supplierRequestAssignmentSummary } from "./supplier-request-assignment-contract";
import { SUPPLIER_REQUEST_REVIEW_PROTOCOL, SUPPLIER_REQUEST_REVIEW_MAX_BODY_BYTES, parseSupplierRequestReviewCommand, parseSupplierRequestReviewQuery, supplierRequestReviewFromRow } from "./supplier-request-review-contract";

export async function checkAssignedSupplierRequestPermission(req: Request, capability: string, resolver?: AdminSessionResolver) {
  const denied = await checkAdmin(req, ["supplier_operator"], resolver);
  return denied || checkAdminPermission(req, capability);
}
const defaults = { authorize: checkAssignedSupplierRequestPermission, principal: getAdminPrincipal, query: sql };
const headers = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
export function makeAssignedSupplierRequestHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, rawId: string | null, mode: "list" | "get" | "reviewGet" | "reviewPost") {
    const reviewMode = mode === "reviewGet" || mode === "reviewPost", write = mode === "reviewPost";
    const protocol = reviewMode ? SUPPLIER_REQUEST_REVIEW_PROTOCOL : SUPPLIER_REQUEST_PROTOCOL;
    try {
      const auth = await deps.authorize(req, write ? "supplier_request.assigned.review" : "supplier_request.assigned.read");
      if (auth) {
        const result = json({ ok: false, protocol, reason: auth.status === 401 ? "supplier_request_unauthorized" : auth.status === 403 ? "supplier_request_assigned_scope_forbidden" : "supplier_request_assigned_unavailable" }, auth.status);
        for (const name of ["retry-after", "x-nexid-auth-outcome"]) { const value = auth.headers.get(name); if (value) result.headers.set(name, value); } return result;
      }
      const principal = deps.principal(req);
      if (principal.scope !== "supplier_operator" || principal.role !== "supplier-operator" || principal.tenantId !== null || principal.tenantSlug !== null) throw new SupplierRequestError("supplier_request_assigned_scope_forbidden", 403);
      const actor = parseSupplierRequestId(principal.userId), session = parseSupplierRequestId(principal.sessionId), scope = { mode: "assigned" as const, operator_id: actor };
      const params = new URL(req.url).searchParams, allowed = mode === "list" ? ["limit"] : mode === "reviewGet" ? ["before_revision"] : [];
      for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new SupplierRequestError("supplier_request_assigned_query_invalid");
      const parsed = reviewMode ? parseSupplierRequestReviewQuery(params, !write) : { before: null };
      const parseItem = (value: unknown) => {
        try {
          if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
          const raw = value as Record<string, unknown>, item = supplierRequestFromRow(raw), assignment = supplierRequestAssignmentSummary(raw.assignment);
          if (assignment.operator_id !== actor || assignment.revision < 1 || item.status === "draft") throw Error();
          return { ...item, assignment };
        } catch { throw Error("assigned_record_invalid"); }
      };
      if (mode === "list") {
        const rawLimit = params.get("limit"), limit = rawLimit === null ? 50 : Number(rawLimit);
        if (rawLimit !== null && (!/^[1-9][0-9]{0,2}$/.test(rawLimit) || limit > 100)) throw new SupplierRequestError("supplier_request_limit_invalid");
        const [row] = await deps.query`SELECT public.nexid_supplier_requests_assigned_v1(${actor}::uuid,${session}::uuid,${limit}::integer) AS result`;
        const raw = row?.result as Record<string, unknown> | null;
        if (raw === null) throw new SupplierRequestError("supplier_request_assigned_scope_forbidden", 403);
        if (!raw || !Array.isArray(raw.items) || raw.items.length > limit || raw.count !== raw.items.length || typeof raw.truncated !== "boolean" || (raw.truncated && raw.items.length !== limit)) throw Error("assigned_record_invalid");
        const items = raw.items.map(parseItem);
        if (new Set(items.map(item => item.id)).size !== items.length) throw Error("assigned_record_invalid");
        return json({ ok: true, protocol, scope, items, count: items.length, truncated: raw.truncated });
      }
      const id = parseSupplierRequestId(rawId);
      if (mode === "get") {
        const [row] = await deps.query`SELECT public.nexid_supplier_request_assigned_current_v1(${id}::uuid,${actor}::uuid,${session}::uuid) AS result`;
        if (row?.result === null) throw new SupplierRequestError("supplier_request_not_found", 404);
        const item = parseItem(row?.result);
        if (item.id !== id) throw Error("assigned_scope_invalid");
        return json({ ok: true, protocol, scope, request: item });
      }
      let command: ReturnType<typeof parseSupplierRequestReviewCommand> | undefined, key: string | undefined, row;
      let sourceTenant: string | undefined, sourceSlug: string | undefined;
      if (write) {
        key = parseSupplierRequestIdempotencyKey(req.headers.get("idempotency-key"));
        if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new SupplierRequestError("supplier_request_review_body_invalid", 415);
        let body: unknown;
        try { body = await readBoundedJsonBody(req, SUPPLIER_REQUEST_REVIEW_MAX_BODY_BYTES); }
        catch (error) { throw new SupplierRequestError(error instanceof RequestBodyTooLargeError ? "supplier_request_review_body_too_large" : "supplier_request_review_body_invalid", error instanceof RequestBodyTooLargeError ? 413 : 400); }
        command = parseSupplierRequestReviewCommand(body);
        if (command.action !== "request_information") throw new SupplierRequestError("supplier_request_review_scope_forbidden", 403);
        // Tenant is derived by the assigned SQL reader; caller-supplied tenant is never accepted.
        const [source] = await deps.query`SELECT public.nexid_supplier_request_assigned_current_v1(${id}::uuid,${actor}::uuid,${session}::uuid) AS result`;
        if (source?.result === null) throw new SupplierRequestError("supplier_request_not_found", 404);
        const item = parseItem(source?.result);
        if (item.id !== id) throw Error("assigned_scope_invalid");
        sourceTenant = item.tenant_id; sourceSlug = item.tenant_slug;
        const input = { ...command, tenant_id: sourceTenant, request_id: id, actor_id: actor, auth_session_id: session, idempotency_key: key };
        [row] = await deps.query`SELECT public.nexid_mutate_supplier_request_review_v1(${JSON.stringify(input)}::jsonb) AS result`;
      } else [row] = await deps.query`SELECT public.nexid_supplier_request_assigned_review_v1(${id}::uuid,${actor}::uuid,${session}::uuid,${parsed.before}::integer) AS result`;
      const raw = row?.result as Record<string, unknown> | undefined;
      if (raw === null && !write) throw new SupplierRequestError("supplier_request_not_found", 404);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("assigned_review_invalid");
      if (write && raw.ok !== true) {
        const reason = String(raw.reason || ""), codes: Record<string, number> = { supplier_request_review_scope_forbidden: 403, supplier_request_not_found: 404, supplier_request_not_submitted: 409, supplier_request_revision_conflict: 409, supplier_request_review_revision_conflict: 409, supplier_request_review_idempotency_conflict: 409, supplier_request_review_transition_invalid: 409 };
        if (!Object.hasOwn(codes, reason)) throw Error("assigned_review_invalid"); throw new SupplierRequestError(reason, codes[reason]);
      }
      try { parseSupplierRequestId(raw.tenant_id); } catch { throw Error("assigned_scope_invalid"); }
      if (typeof raw.tenant_slug !== "string" || !SUPPLIER_REQUEST_TENANT_SLUG.test(raw.tenant_slug) || (write && (raw.tenant_id !== sourceTenant || raw.tenant_slug !== sourceSlug))) throw Error("assigned_scope_invalid");
      const data = supplierRequestReviewFromRow(raw, parsed.before);
      if (data.request_id !== id) throw Error("assigned_scope_invalid");
      const base = { ok: true, protocol, scope, ...data };
      if (!write) return json(base);
      const receipt = raw.receipt as Record<string, unknown> | undefined;
      if (typeof raw.idempotent_replay !== "boolean" || !receipt || receipt.idempotency_key !== key || receipt.action !== command!.action || receipt.revision !== command!.expected_revision + 1
        || Number(receipt.revision) > data.review.revision || data.request_revision < command!.expected_request_revision
        || (!raw.idempotent_replay && (receipt.revision !== data.review.revision || data.request_revision !== command!.expected_request_revision))) throw Error("assigned_receipt_invalid");
      return json({ ...base, idempotent_replay: raw.idempotent_replay, receipt: { idempotency_key: key, action: command!.action, revision: receipt.revision } });
    } catch (error) {
      if (error instanceof SupplierRequestError) return json({ ok: false, protocol, reason: error.message }, error.status);
      return json({ ok: false, protocol, reason: "supplier_request_assigned_unavailable" }, 503);
    }
  }
  return { list: (req: Request) => handle(req, null, "list"), get: (req: Request, id: string) => handle(req, id, "get"), reviewGet: (req: Request, id: string) => handle(req, id, "reviewGet"), reviewPost: (req: Request, id: string) => handle(req, id, "reviewPost") };
}
