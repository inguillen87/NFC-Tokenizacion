import { checkAdminWithPermission, getAdminPrincipal } from "./auth";
import { sql } from "./db";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "./bounded-request-body";
import { SupplierRequestError, parseSupplierRequestId, parseSupplierRequestIdempotencyKey } from "./supplier-request-contract";
import { resolveSupplierRequestScope } from "./supplier-request-store";
import { parseSupplierRequestReviewQuery } from "./supplier-request-review-contract";
import { SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL, SUPPLIER_REQUEST_ASSIGNMENT_MAX_BODY_BYTES, parseSupplierRequestAssignmentCommand, supplierRequestAssignmentFromRow } from "./supplier-request-assignment-contract";

const defaults = { authorize: checkAdminWithPermission, principal: getAdminPrincipal, query: sql };
const headers = { "cache-control": "private, no-store, max-age=0", "referrer-policy": "no-referrer" };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers });
export function makeSupplierRequestAssignmentHandlers(overrides: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...overrides };
  async function handle(req: Request, rawId: string | null, write: boolean) {
    try {
      const auth = await deps.authorize(req, "supplier_request.assign");
      if (auth) {
        const result = json({ ok: false, protocol: SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL, reason: auth.status === 401 ? "supplier_request_unauthorized" : auth.status === 403 ? "supplier_request_assignment_scope_forbidden" : "supplier_request_assignments_unavailable" }, auth.status);
        for (const name of ["retry-after", "x-nexid-auth-outcome"]) { const value = auth.headers.get(name); if (value) result.headers.set(name, value); } return result;
      }
      const principal = deps.principal(req);
      if (principal.scope !== "super_admin" || principal.role !== "super-admin" || principal.tenantId !== null || principal.tenantSlug !== null) throw new SupplierRequestError("supplier_request_assignment_scope_forbidden", 403);
      const params = new URL(req.url).searchParams;
      if (rawId === null) {
        if (params.size) throw new SupplierRequestError("supplier_request_assignment_query_invalid");
        const rows = await deps.query`SELECT u.id,COALESCE(NULLIF(btrim(u.full_name),''),'Operador interno') AS display_name FROM public.users u
          WHERE public.nexid_supplier_operator_eligible_v1(u.id) ORDER BY display_name,u.id LIMIT 101`;
        const operators = rows.slice(0, 100).map(row => { if (typeof row.display_name !== "string" || !row.display_name.trim()) throw Error("operator_record_invalid"); return { id: parseSupplierRequestId(row.id), display_name: row.display_name }; });
        if (new Set(operators.map(item => item.id)).size !== operators.length) throw Error("operator_record_invalid");
        return json({ ok: true, protocol: SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL, scope: { mode: "global", tenant_id: null, tenant_slug: null }, operators, count: operators.length, truncated: rows.length > 100 });
      }
      const parsed = parseSupplierRequestReviewQuery(params, !write), id = parseSupplierRequestId(rawId);
      const scope = await resolveSupplierRequestScope(parsed.tenant, principal, false, deps.query);
      let command: ReturnType<typeof parseSupplierRequestAssignmentCommand> | undefined, key: string | undefined, row;
      if (write) {
        key = parseSupplierRequestIdempotencyKey(req.headers.get("idempotency-key"));
        if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new SupplierRequestError("supplier_request_assignment_body_invalid", 415);
        let body: unknown;
        try { body = await readBoundedJsonBody(req, SUPPLIER_REQUEST_ASSIGNMENT_MAX_BODY_BYTES); }
        catch (error) { throw new SupplierRequestError(error instanceof RequestBodyTooLargeError ? "supplier_request_assignment_body_too_large" : "supplier_request_assignment_body_invalid", error instanceof RequestBodyTooLargeError ? 413 : 400); }
        command = parseSupplierRequestAssignmentCommand(body);
        const input = { ...command, tenant_id: scope.tenant_id, request_id: id, actor_id: parseSupplierRequestId(principal.userId), auth_session_id: parseSupplierRequestId(principal.sessionId), idempotency_key: key };
        [row] = await deps.query`SELECT public.nexid_mutate_supplier_request_assignment_v1(${JSON.stringify(input)}::jsonb) AS result`;
      } else [row] = await deps.query`SELECT public.nexid_supplier_request_assignment_current_v1(${id}::uuid,${scope.tenant_id}::uuid,${parsed.before}::integer) AS result`;
      const raw = row?.result as Record<string, unknown> | undefined;
      if (!raw && !write) throw new SupplierRequestError("supplier_request_not_found", 404);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("assignment_record_invalid");
      if (write && raw.ok !== true) {
        const reason = String(raw.reason || ""), codes: Record<string, number> = { supplier_request_assignment_scope_forbidden: 403, supplier_request_not_found: 404, supplier_request_not_submitted: 409, supplier_request_revision_conflict: 409, supplier_request_assignment_revision_conflict: 409, supplier_request_assignment_idempotency_conflict: 409, supplier_request_assignment_transition_invalid: 409, supplier_request_assignment_operator_invalid: 409 };
        if (!Object.hasOwn(codes, reason)) throw Error("assignment_record_invalid"); throw new SupplierRequestError(reason, codes[reason]);
      }
      if (raw.tenant_id !== scope.tenant_id || raw.tenant_slug !== scope.tenant_slug) throw Error("assignment_scope_invalid");
      const data = supplierRequestAssignmentFromRow(raw, parsed.before);
      if (data.request_id !== id) throw Error("assignment_scope_invalid");
      const base = { ok: true, protocol: SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL, scope, ...data };
      if (!write) return json(base);
      const receipt = raw.receipt as Record<string, unknown> | undefined, action = command!.operator_id === null ? "unassign" : "assign";
      if (typeof raw.idempotent_replay !== "boolean" || !receipt || receipt.idempotency_key !== key || receipt.action !== action || receipt.revision !== command!.expected_revision + 1
        || Number(receipt.revision) > data.assignment.revision || data.request_revision < command!.expected_request_revision
        || (!raw.idempotent_replay && (receipt.revision !== data.assignment.revision || data.request_revision !== command!.expected_request_revision || data.assignment.operator_id !== command!.operator_id))) throw Error("assignment_receipt_invalid");
      return json({ ...base, idempotent_replay: raw.idempotent_replay, receipt: { idempotency_key: key, action, revision: receipt.revision } });
    } catch (error) {
      if (error instanceof SupplierRequestError) return json({ ok: false, protocol: SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL, reason: error.message }, error.status);
      return json({ ok: false, protocol: SUPPLIER_REQUEST_ASSIGNMENT_PROTOCOL, reason: "supplier_request_assignments_unavailable" }, 503);
    }
  }
  return { get: (req: Request, id: string) => handle(req, id, false), post: (req: Request, id: string) => handle(req, id, true), candidates: (req: Request) => handle(req, null, false) };
}
