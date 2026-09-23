import type { AdminPrincipal } from "./auth";
import { sql, type SqlExecutor } from "./db";
import { SupplierRequestError, SUPPLIER_REQUEST_CONSTRUCTIONS, SUPPLIER_REQUEST_UUID, SUPPLIER_REQUEST_TENANT_SLUG, parseSupplierRequestId, parseSupplierRequestRevision, supplierRequestFromRow, type SupplierRequestContent } from "./supplier-request-contract";

export type SupplierRequestScope = { mode: "tenant"; tenant_id: string; tenant_slug: string } | { mode: "global"; tenant_id: null; tenant_slug: null };
export async function resolveSupplierRequestScope(requested: string | null, principal: AdminPrincipal, allowGlobal: boolean, query: SqlExecutor): Promise<SupplierRequestScope> {
  if (requested === null && allowGlobal && principal.scope === "super_admin") return { mode: "global", tenant_id: null, tenant_slug: null };
  const slug = requested?.trim().toLowerCase();
  if (!slug || !SUPPLIER_REQUEST_TENANT_SLUG.test(slug)) throw new SupplierRequestError("supplier_request_tenant_required");
  if (principal.scope !== "super_admin" && (slug !== principal.tenantSlug || !principal.tenantId || !SUPPLIER_REQUEST_UUID.test(principal.tenantId))) throw new SupplierRequestError("supplier_request_scope_forbidden", 403);
  const [tenant] = await query`SELECT id, slug FROM public.tenants WHERE lower(slug) = ${slug} LIMIT 1`;
  if (!tenant) throw new SupplierRequestError("supplier_request_tenant_not_found", 404);
  if (typeof tenant.id !== "string" || !SUPPLIER_REQUEST_UUID.test(tenant.id) || tenant.slug !== slug) throw new Error("supplier_request_scope_invalid");
  if (principal.scope !== "super_admin" && tenant.id.toLowerCase() !== principal.tenantId?.toLowerCase()) throw new SupplierRequestError("supplier_request_scope_forbidden", 403);
  return { mode: "tenant", tenant_id: tenant.id.toLowerCase(), tenant_slug: slug };
}
export async function listSupplierRequests(scope: SupplierRequestScope, options: { limit: number; status: string }, query: SqlExecutor) {
  const rows = await query`SELECT request.*, tenant.slug AS tenant_slug
    FROM public.supplier_requests request JOIN public.tenants tenant ON tenant.id=request.tenant_id
    WHERE (${scope.tenant_id}::uuid IS NULL OR request.tenant_id=${scope.tenant_id}::uuid)
      AND (${scope.tenant_id}::uuid IS NOT NULL OR request.status IN ('submitted','provisioned'))
      AND (${options.status}='all' OR request.status=${options.status})
    ORDER BY request.updated_at DESC, request.id DESC LIMIT ${options.limit + 1}`;
  const items = rows.slice(0, options.limit).map(supplierRequestFromRow);
  if (items.some(item => scope.mode === "tenant" ? item.tenant_id !== scope.tenant_id || item.tenant_slug !== scope.tenant_slug : item.status === "draft")) throw new Error("supplier_request_scope_invalid");
  return { items, count: items.length, truncated: rows.length > options.limit };
}
export async function getSupplierRequest(scope: SupplierRequestScope, id: string, query: SqlExecutor = sql) {
  if (scope.mode !== "tenant") throw new SupplierRequestError("supplier_request_tenant_required");
  const [row] = await query`SELECT request.*, tenant.slug AS tenant_slug FROM public.supplier_requests request
    JOIN public.tenants tenant ON tenant.id=request.tenant_id WHERE request.id=${id}::uuid AND request.tenant_id=${scope.tenant_id}::uuid LIMIT 1`;
  if (!row) throw new SupplierRequestError("supplier_request_not_found", 404);
  const item = supplierRequestFromRow(row);
  if (item.tenant_id !== scope.tenant_id || item.tenant_slug !== scope.tenant_slug) throw new Error("supplier_request_scope_invalid");
  return item;
}
export async function mutateSupplierRequest(scope: SupplierRequestScope, principal: AdminPrincipal, action: "create" | "patch" | "submit", id: string | null,
  key: string, expectedRevision: number | null, content: SupplierRequestContent | null, query: SqlExecutor) {
  if (scope.mode !== "tenant") throw new SupplierRequestError("supplier_request_tenant_required");
  const input = { action, tenant_id: scope.tenant_id, actor_id: parseSupplierRequestId(principal.userId), auth_session_id: parseSupplierRequestId(principal.sessionId), request_id: id,
    idempotency_key: key, expected_revision: expectedRevision, content };
  const [row] = await query`SELECT public.nexid_mutate_supplier_request_v1(${JSON.stringify(input)}::jsonb) AS result`;
  const result = row?.result as Record<string, unknown> | undefined;
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("supplier_request_result_invalid");
  if (result.ok !== true) {
    const reason = String(result.reason || "");
    const codes: Record<string, number> = { supplier_request_scope_forbidden: 403, supplier_request_not_found: 404, supplier_request_revision_conflict: 409, supplier_request_idempotency_conflict: 409, supplier_request_not_draft: 409, supplier_request_incomplete: 409 };
    if (!Object.hasOwn(codes, reason)) throw new Error("supplier_request_result_invalid");
    throw new SupplierRequestError(reason, codes[reason], Number.isSafeInteger(result.current_revision) ? { current_revision: Number(result.current_revision) } : {});
  }
  const item = supplierRequestFromRow(result.request as Record<string, unknown>);
  const receipt = result.receipt as Record<string, unknown> | undefined;
  if (item.tenant_id !== scope.tenant_id || item.tenant_slug !== scope.tenant_slug || (id && item.id !== id) || typeof result.idempotent_replay !== "boolean"
    || !receipt || receipt.idempotency_key !== key || receipt.action !== action || !Number.isSafeInteger(receipt.revision) || Number(receipt.revision) < 1 || Number(receipt.revision) > item.revision) throw new Error("supplier_request_result_invalid");
  return { request: item, idempotent_replay: result.idempotent_replay, receipt: { idempotency_key: key, action, revision: Number(receipt.revision) } };
}
export function parseSupplierRequestSource(body: Record<string, unknown>) {
  const hasId = Object.hasOwn(body, "source_request_id"), hasRevision = Object.hasOwn(body, "source_request_revision");
  if (!hasId && !hasRevision) return null;
  if (!hasId || !hasRevision) throw new SupplierRequestError("supplier_request_source_invalid");
  return { id: parseSupplierRequestId(body.source_request_id), revision: parseSupplierRequestRevision(body.source_request_revision) };
}
export async function hasSupplierRequestConversion(query: SqlExecutor = sql) {
  const [row] = await query`SELECT to_regprocedure('public.nexid_convert_supplier_request_v1(uuid,integer,jsonb)') IS NOT NULL
    AND COALESCE(has_function_privilege(current_user,to_regprocedure('public.nexid_convert_supplier_request_v1(uuid,integer,jsonb)'),'EXECUTE'),false) AS available`;
  return row?.available === true;
}
export function supplierRequestConversionError(error: unknown) {
  if (error instanceof SupplierRequestError) return error;
  const message = error instanceof Error ? error.message : "";
  const reasons: Record<string, number> = { supplier_request_operator_required: 403, supplier_request_not_found: 404, supplier_request_source_invalid: 400,
    supplier_request_already_provisioned: 409, supplier_request_not_submitted: 409, supplier_request_revision_conflict: 409, supplier_request_order_mismatch: 409 };
  for (const [reason, status] of Object.entries(reasons)) if (message.includes(reason)) return new SupplierRequestError(reason, status);
  return null;
}
export async function validateSupplierRequestConversion(source: { id: string; revision: number }, principal: AdminPrincipal,
  tenant: { id: string; slug: string }, technical: { quantity: number; purpose: string; carrier: string; chip: string; material: string }, query: SqlExecutor = sql) {
  if (principal.scope !== "super_admin") throw new SupplierRequestError("supplier_request_operator_required", 403);
  const request = await getSupplierRequest({ mode: "tenant", tenant_id: tenant.id.toLowerCase(), tenant_slug: tenant.slug }, source.id, query);
  if (request.status === "provisioned") throw new SupplierRequestError("supplier_request_already_provisioned", 409, { order_id: request.order_id! });
  if (request.status !== "submitted") throw new SupplierRequestError("supplier_request_not_submitted", 409);
  if (request.revision !== source.revision) throw new SupplierRequestError("supplier_request_revision_conflict", 409, { current_revision: request.revision });
  const construction = request.construction_id ? SUPPLIER_REQUEST_CONSTRUCTIONS[request.construction_id] : null;
  if (!construction || technical.quantity !== request.quantity || technical.purpose !== request.pack_purpose || technical.carrier !== construction.carrier || technical.material !== construction.material
    || (construction.chip ? technical.chip !== construction.chip : !technical.chip || /NTAG/i.test(technical.chip))) throw new SupplierRequestError("supplier_request_order_mismatch", 409);
  return request;
}
