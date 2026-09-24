import { parseSupplierRequestRecord, SupplierRequestError, SUPPLIER_REQUEST_UUID, type SupplierRequest } from "./supplier-request-client";
export const SUPPLIER_REQUEST_CANCELLATION_PROTOCOL = "nexid.supplier-request-cancellation.v1";
export type SupplierCancellationCommand = Readonly<{ key: string; body: Readonly<{ expected_revision: number; expected_review_revision: number; reason: string }> }>;
export type SupplierCancellationSnapshot = { request: SupplierRequest; receipt?: { idempotency_key: string; action: "cancel"; revision: number }; idempotent_replay?: boolean };
type Scope = { tenant: string; tenantId: string; id: string };
const invalid = (): never => { throw new SupplierRequestError("contract_invalid"); };
export function parseSupplierCancellation(payload: any, scope: Scope, command?: SupplierCancellationCommand): SupplierCancellationSnapshot {
 if (!payload || payload.ok !== true || payload.protocol !== SUPPLIER_REQUEST_CANCELLATION_PROTOCOL || payload.available !== true
  || payload.demo === true || payload.demoMode === true || payload.dataSource === "demo" || payload.scope?.mode !== "tenant"
  || payload.scope.tenant_id !== scope.tenantId || payload.scope.tenant_slug !== scope.tenant) return invalid();
 const request = parseSupplierRequestRecord(payload.request, scope.tenant);
 if (request.id !== scope.id || request.tenant_id !== scope.tenantId || !request.review_summary) return invalid();
 if (!command) return { request };
 const receipt = payload.receipt;
 if (request.status !== "cancelled" || request.revision !== command.body.expected_revision + 1 || request.cancellation_reason !== command.body.reason
  || request.review_summary.revision !== command.body.expected_review_revision || typeof payload.idempotent_replay !== "boolean"
  || !receipt || receipt.idempotency_key !== command.key || receipt.action !== "cancel" || receipt.revision !== request.revision) return invalid();
 return { request, receipt: { idempotency_key: receipt.idempotency_key, action: "cancel", revision: receipt.revision }, idempotent_replay: payload.idempotent_replay };
}
async function boundedJson(response: Response) {
 const reader = response.body?.getReader(); if (!reader) return null;
 const decoder = new TextDecoder("utf-8", { fatal: true }); let bytes = 0, text = "";
 try { while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength;
  if (bytes > 64 * 1024) { await reader.cancel(); return invalid(); } text += decoder.decode(part.value, { stream: true });
 } text += decoder.decode(); return JSON.parse(text); } finally { reader.releaseLock(); }
}
export async function supplierCancellationCall(input: Scope & { command?: SupplierCancellationCommand; signal?: AbortSignal }, fetcher: typeof fetch = fetch): Promise<SupplierCancellationSnapshot> {
 if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(input.tenant) || !SUPPLIER_REQUEST_UUID.test(input.tenantId) || !SUPPLIER_REQUEST_UUID.test(input.id)
  || (input.command && !SUPPLIER_REQUEST_UUID.test(input.command.key))) throw new SupplierRequestError("scope_invalid");
 const body = input.command?.body;
 if (body && (Object.keys(body).length !== 3 || !Number.isSafeInteger(body.expected_revision) || body.expected_revision < 1 || body.expected_revision >= 2147483647
  || !Number.isSafeInteger(body.expected_review_revision) || body.expected_review_revision < 0 || body.expected_review_revision >= 2147483647
  || typeof body.reason !== "string" || !body.reason.trim() || body.reason.length > 2000 || body.reason !== body.reason.trim())) throw new SupplierRequestError("scope_invalid");
 const controller = new AbortController(), abort = () => controller.abort();
 if (input.signal?.aborted) abort(); else input.signal?.addEventListener("abort", abort, { once: true });
 const timer = setTimeout(abort, 20_000), command = input.command;
 try {
  const response = await fetcher(`/api/admin/supplier-requests/${input.id}/cancellation?tenant=${encodeURIComponent(input.tenant)}`, {
   method: command ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal,
   headers: { Accept: "application/json", ...(command ? { "Content-Type": "application/json", "Idempotency-Key": command.key } : {}) }, ...(command ? { body: JSON.stringify(command.body) } : {})
  });
  let body: any; try { body = await boundedJson(response); } catch { throw new SupplierRequestError("contract_invalid", response.status, Boolean(command)); }
  if (!response.ok) { const certain = response.status < 500 && response.status !== 408 && body?.ok === false && typeof body.reason === "string";
   throw new SupplierRequestError(certain ? body.reason : "unavailable", response.status, Boolean(command && !certain)); }
  if (response.headers.get("x-nexid-data-mode") !== "production" || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) throw new SupplierRequestError("contract_invalid", response.status, Boolean(command));
  try { return parseSupplierCancellation(body, input, command); } catch { throw new SupplierRequestError("contract_invalid", response.status, Boolean(command)); }
 } catch (error) { if (error instanceof SupplierRequestError) throw error; throw new SupplierRequestError("unavailable", 0, Boolean(command)); }
 finally { clearTimeout(timer); input.signal?.removeEventListener("abort", abort); }
}
