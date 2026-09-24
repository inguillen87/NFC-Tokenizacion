import { parseSupplierRequestRecord, SupplierRequestError, SUPPLIER_REQUEST_UUID, type SupplierRequest } from "./supplier-request-client";
export type SupplierAssignedRequest = SupplierRequest & { assignment: { operator_id: string; revision: number; updated_at: string } };
const invalid = (): never => { throw new SupplierRequestError("contract_invalid"); };
const object = (value: unknown): Record<string, any> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
export function parseSupplierAssignedRequests(payload: unknown, operatorId: string, id?: string): { items: SupplierAssignedRequest[]; truncated: boolean } | { request: SupplierAssignedRequest } {
  const data = object(payload), scope = object(data?.scope);
  if (!SUPPLIER_REQUEST_UUID.test(operatorId) || !data || data.ok !== true || data.protocol !== "nexid.supplier-request.v1" || data.demo === true || data.demoMode === true || data.dataSource === "demo" || !scope || scope.mode !== "assigned" || scope.operator_id !== operatorId) return invalid();
  function parse(raw: unknown): SupplierAssignedRequest {
    const item = parseSupplierRequestRecord(raw), assignment = object(object(raw)?.assignment);
    if (item.status === "draft" || item.status === "cancelled" || !item.review_summary || !assignment || assignment.operator_id !== operatorId || !Number.isSafeInteger(assignment.revision) || assignment.revision < 1 || typeof assignment.updated_at !== "string" || !Number.isFinite(Date.parse(assignment.updated_at))) return invalid();
    return { ...item, assignment: { operator_id: operatorId, revision: assignment.revision, updated_at: assignment.updated_at } };
  }
  if (id) { const request = parse(data.request); if (request.id !== id) return invalid(); return { request }; }
  if (!Array.isArray(data.items) || data.items.length > 100 || data.count !== data.items.length || typeof data.truncated !== "boolean") return invalid();
  const items = data.items.map(parse); if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
  return { items, truncated: data.truncated };
}
export async function supplierAssignedRequestCall(input: { operatorId: string; id?: string; signal?: AbortSignal }, fetcher: typeof fetch = fetch) {
  if (!SUPPLIER_REQUEST_UUID.test(input.operatorId) || (input.id && !SUPPLIER_REQUEST_UUID.test(input.id))) throw new SupplierRequestError("scope_invalid");
  const controller = new AbortController(), abort = () => controller.abort();
  if (input.signal?.aborted) abort(); else input.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  try {
    const response = await fetcher(`/api/admin/supplier-requests/assigned${input.id ? `/${input.id}` : ""}`, { method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    const text = await response.text(); let body: any = null;
    if (new TextEncoder().encode(text).byteLength <= (input.id ? 64 * 1024 : 100 * 32 * 1024)) { try { body = JSON.parse(text); } catch {} }
    if (!response.ok) throw new SupplierRequestError(object(body)?.ok === false && typeof body.reason === "string" ? body.reason : "unavailable", response.status);
    if (response.headers.get("x-nexid-data-mode") !== "production") return invalid();
    return parseSupplierAssignedRequests(body, input.operatorId, input.id);
  } catch (error) { if (error instanceof SupplierRequestError) throw error; throw new SupplierRequestError("unavailable"); }
  finally { clearTimeout(timer); input.signal?.removeEventListener("abort", abort); }
}
