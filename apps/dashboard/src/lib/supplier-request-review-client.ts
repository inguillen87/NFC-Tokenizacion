import { parseSupplierRequestReviewSummary, SUPPLIER_REQUEST_UUID, SupplierRequestError, type SupplierRequestReviewSummary } from "./supplier-request-client";

export type SupplierRequestReviewAction = "request_information" | "respond";
export type SupplierRequestReviewEvent = { id: string; revision: number; request_revision: number; action: SupplierRequestReviewAction; message: string; actor_id: string; created_at: string };
export type SupplierRequestReviewEnvelope = { request_id: string; request_revision: number; review: SupplierRequestReviewSummary; history: SupplierRequestReviewEvent[]; count: number; truncated: boolean; next_before_revision: number | null; receipt?: { idempotency_key: string; action: SupplierRequestReviewAction; revision: number }; idempotent_replay?: boolean };
export type SupplierRequestReviewCommand = Readonly<{ tenant: string; id: string; key: string; operatorId?: string; body: Readonly<{ action: SupplierRequestReviewAction; message: string; expected_revision: number; expected_request_revision: number }> }>;
type Binding = { tenant: string; tenantId: string; id: string; beforeRevision?: number; operatorId?: string };
const record = (value: unknown): Record<string, any> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
const integer = (value: unknown, minimum = 1): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= 2_147_483_646;
const date = (value: unknown) => typeof value === "string" && !!value && Number.isFinite(Date.parse(value));
const invalid = (): never => { throw new SupplierRequestError("contract_invalid"); };
export function parseSupplierRequestReviewEnvelope(payload: unknown, binding: Binding): SupplierRequestReviewEnvelope {
  const data = record(payload), scope = record(data?.scope);
  if (!data || data.ok !== true || data.protocol !== "nexid.supplier-request-review.v1" || data.demo === true || data.demoMode === true || data.dataSource === "demo" || !scope || data.request_id !== binding.id || !integer(data.request_revision)) return invalid();
  if (binding.operatorId ? !SUPPLIER_REQUEST_UUID.test(binding.operatorId) || scope.mode !== "assigned" || scope.operator_id !== binding.operatorId : scope.mode !== "tenant" || scope.tenant_slug !== binding.tenant || scope.tenant_id !== binding.tenantId) return invalid();
  const review = parseSupplierRequestReviewSummary(data.review);
  if (!integer(review.revision, 0) || !Array.isArray(data.history) || data.history.length > 100 || data.count !== data.history.length || typeof data.truncated !== "boolean") return invalid();
  let previous = 0;
  const ids = new Set<string>();
  const history: SupplierRequestReviewEvent[] = data.history.map((raw: unknown) => {
    const item = record(raw);
    if (!item || typeof item.id !== "string" || !SUPPLIER_REQUEST_UUID.test(item.id) || ids.has(item.id) || !integer(item.revision) || item.revision <= previous || item.revision > review.revision || (binding.beforeRevision !== undefined && item.revision >= binding.beforeRevision) || !integer(item.request_revision) || item.request_revision > data.request_revision || !["request_information", "respond"].includes(item.action) || typeof item.message !== "string" || !item.message.trim() || item.message.length > 2000 || typeof item.actor_id !== "string" || !SUPPLIER_REQUEST_UUID.test(item.actor_id) || !date(item.created_at)) return invalid();
    if (previous && item.revision !== previous + 1) return invalid();
    previous = item.revision; ids.add(item.id);
    return { id: item.id, revision: item.revision, request_revision: item.request_revision, action: item.action, message: item.message, actor_id: item.actor_id, created_at: item.created_at };
  });
  if (data.truncated !== Boolean(history.length && history[0].revision > 1) || (data.truncated ? data.next_before_revision !== history[0].revision : data.next_before_revision !== null)) return invalid();
  const lastExpected = Math.min(review.revision, binding.beforeRevision === undefined ? review.revision : binding.beforeRevision - 1);
  if (history.length !== Math.min(100, lastExpected)) return invalid();
  if (lastExpected === 0 ? history.length !== 0 : history.at(-1)?.revision !== lastExpected) return invalid();
  if (binding.beforeRevision === undefined) {
    const last = history.at(-1);
    if (review.revision === 0 ? history.length !== 0 || data.truncated : !last || last.revision !== review.revision || (last.action === "request_information" ? review.state !== "needs_information" : review.state !== "answered") || last.created_at !== review.updated_at) return invalid();
  }
  const result: SupplierRequestReviewEnvelope = { request_id: data.request_id, request_revision: data.request_revision, review, history, count: history.length, truncated: data.truncated, next_before_revision: data.next_before_revision };
  if (data.receipt !== undefined) {
    const receipt = record(data.receipt);
    if (!receipt || !SUPPLIER_REQUEST_UUID.test(receipt.idempotency_key) || !["request_information", "respond"].includes(receipt.action) || !integer(receipt.revision) || receipt.revision > review.revision || typeof data.idempotent_replay !== "boolean") return invalid();
    result.receipt = { idempotency_key: receipt.idempotency_key, action: receipt.action, revision: receipt.revision }; result.idempotent_replay = data.idempotent_replay;
  }
  return result;
}
export async function supplierRequestReviewCall(input: Binding & { command?: SupplierRequestReviewCommand; signal?: AbortSignal }, fetcher: typeof fetch = fetch): Promise<SupplierRequestReviewEnvelope> {
  const command = input.command;
  if ((input.operatorId && !SUPPLIER_REQUEST_UUID.test(input.operatorId)) || (command && (command.operatorId !== input.operatorId || (input.operatorId && command.body.action !== "request_information")))) throw new SupplierRequestError("scope_invalid");
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(input.tenant) || !SUPPLIER_REQUEST_UUID.test(input.tenantId) || !SUPPLIER_REQUEST_UUID.test(input.id) || (input.beforeRevision !== undefined && (!integer(input.beforeRevision) || command)) || (command && (command.tenant !== input.tenant || command.id !== input.id || !SUPPLIER_REQUEST_UUID.test(command.key) || !integer(command.body.expected_revision, 0) || !integer(command.body.expected_request_revision) || !["request_information", "respond"].includes(command.body.action) || !command.body.message.trim() || command.body.message.length > 2000))) throw new SupplierRequestError("scope_invalid");
  const controller = new AbortController(), abort = () => controller.abort();
  if (input.signal?.aborted) abort(); else input.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  try {
    const query = new URLSearchParams(); if (!input.operatorId) query.set("tenant", input.tenant); if (input.beforeRevision !== undefined) query.set("before_revision", String(input.beforeRevision));
    const response = await fetcher(`/api/admin/supplier-requests/${input.operatorId ? "assigned/" : ""}${input.id}/review${query.size ? `?${query}` : ""}`, { method: command ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal, headers: { Accept: "application/json", ...(command ? { "Content-Type": "application/json", "Idempotency-Key": command.key } : {}) }, ...(command ? { body: JSON.stringify(command.body) } : {}) });
    const text = await response.text(); let data: any = null;
    if (new TextEncoder().encode(text).byteLength <= 100 * 16 * 1024) { try { data = JSON.parse(text); } catch {} }
    if (!response.ok) {
      const certain = response.status < 500 && response.status !== 408 && record(data)?.ok === false && typeof data.reason === "string";
      throw new SupplierRequestError(certain ? data.reason : "unavailable", response.status, Boolean(command && !certain));
    }
    try {
      if (response.headers.get("x-nexid-data-mode") !== "production") return invalid();
      const result = parseSupplierRequestReviewEnvelope(data, input);
      if (command) {
        if (result.receipt?.idempotency_key !== command.key || result.receipt.action !== command.body.action || result.receipt.revision !== command.body.expected_revision + 1 || result.request_revision < command.body.expected_request_revision) return invalid();
        const event = result.history.find(item => item.revision === result.receipt!.revision);
        if (event && (event.message !== command.body.message || event.action !== command.body.action || event.request_revision !== command.body.expected_request_revision)) return invalid();
        if (result.review.revision === result.receipt.revision && !event) return invalid();
      }
      return result;
    } catch { throw new SupplierRequestError("contract_invalid", response.status, Boolean(command)); }
  } catch (error) { if (error instanceof SupplierRequestError) throw error; throw new SupplierRequestError("unavailable", 0, Boolean(command)); }
  finally { clearTimeout(timer); input.signal?.removeEventListener("abort", abort); }
}
export function supplierRequestReviewErrorCopy(error: SupplierRequestError) {
  if (error.uncertain) return "No se confirmó el mensaje. Conservamos el texto y la misma operación para comprobar el resultado sin duplicarlo.";
  if (["supplier_request_revision_conflict", "supplier_request_review_revision_conflict", "supplier_request_review_transition_invalid", "supplier_request_not_submitted"].includes(error.code)) return "La solicitud o la conversación cambió. Tu texto sigue aquí. Consultá el estado actual antes de volver a revisarlo.";
  if (error.status === 401 || error.status === 403) return "Tu acceso no permite esta acción. Conservamos el mensaje escrito.";
  if (error.code.includes("secret")) return "Retirá llaves, tokens y otros secretos del mensaje antes de revisarlo.";
  return "No pudimos confirmar las aclaraciones. Conservamos tu texto; volvé a consultar el estado antes de continuar.";
}
