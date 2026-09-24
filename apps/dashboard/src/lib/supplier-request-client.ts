import { SUPPLIER_CONSTRUCTIONS } from "./supplier-order-draft";

export type SupplierRequestContent = { title: string; construction_id: string; quantity: number | null; pack_purpose: "trial_integration" | "production" | null; notes: string };
export type SupplierRequestReviewSummary = { state: "pending" | "needs_information" | "answered"; revision: number; updated_at: string | null };
export type SupplierRequest = SupplierRequestContent & { id: string; tenant_id: string; tenant_slug: string; status: "draft" | "submitted" | "provisioned" | "cancelled"; revision: number; created_at: string; updated_at: string; submitted_at: string | null; order_id: string | null; quotation_revision?: number; quotation_state?: "offered" | "accepted" | "rejected" | "withdrawn" | null; cancellation_reason?: string; cancelled_by?: string; cancelled_at?: string; review_summary?: SupplierRequestReviewSummary };
export type SupplierRequestReceipt = { idempotency_key: string; action: "create" | "patch" | "submit"; revision: number };
export type SupplierRequestEnvelope = { request: SupplierRequest; receipt?: SupplierRequestReceipt; idempotent_replay?: boolean };
export type SupplierRequestCommand = Readonly<{ tenant: string; id?: string; action: "create" | "patch" | "submit"; key: string; body: SupplierRequestContent | (SupplierRequestContent & { expected_revision: number }) | { expected_revision: number } }>;
export const SUPPLIER_REQUEST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tenantPattern = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/;
const object = (value: unknown): Record<string, any> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
const date = (value: unknown) => typeof value === "string" && !!value && Number.isFinite(Date.parse(value));
const revision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
export class SupplierRequestError extends Error {
  constructor(readonly code: string, readonly status = 0, readonly uncertain = false) { super(code); }
}
function invalid(): never { throw new SupplierRequestError("contract_invalid"); }
export function parseSupplierRequestReviewSummary(value: unknown): SupplierRequestReviewSummary {
  const item = object(value);
  if (!item || !["pending", "needs_information", "answered"].includes(item.state) || !Number.isSafeInteger(item.revision) || item.revision < 0 || (item.revision === 0 ? item.state !== "pending" || item.updated_at !== null : item.state === "pending" || !date(item.updated_at))) return invalid();
  return { state: item.state, revision: item.revision, updated_at: item.updated_at };
}
function scopeOf(payload: unknown, tenant: string) {
  const envelope = object(payload), scope = object(envelope?.scope);
  if (!envelope || envelope.ok !== true || envelope.protocol !== "nexid.supplier-request.v1" || envelope.demoMode === true || envelope.demo === true || envelope.dataSource === "demo" || !scope) return invalid();
  if (tenant ? scope.mode !== "tenant" || scope.tenant_slug !== tenant || !SUPPLIER_REQUEST_UUID.test(scope.tenant_id) : scope.mode !== "global" || scope.tenant_id !== null || scope.tenant_slug !== null) return invalid();
  return { envelope, scope };
}
export function parseSupplierRequestRecord(raw: unknown, tenant = ""): SupplierRequest {
  const item = object(raw);
  if (!item || typeof item.id !== "string" || !SUPPLIER_REQUEST_UUID.test(item.id) || typeof item.tenant_id !== "string" || !SUPPLIER_REQUEST_UUID.test(item.tenant_id) || typeof item.tenant_slug !== "string" || !tenantPattern.test(item.tenant_slug) || (tenant && item.tenant_slug !== tenant)
    || !["draft", "submitted", "provisioned", "cancelled"].includes(item.status) || !revision(item.revision) || typeof item.title !== "string" || !item.title.trim() || item.title.length > 200 || typeof item.notes !== "string" || item.notes.length > 4000
    || !(item.construction_id === "" || SUPPLIER_CONSTRUCTIONS.some(profile => profile.id === item.construction_id)) || !(item.quantity === null || (Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 100_000_000)) || ![null, "trial_integration", "production"].includes(item.pack_purpose)
    || !date(item.created_at) || !date(item.updated_at) || !(item.submitted_at === null || date(item.submitted_at)) || !(item.order_id === null || (typeof item.order_id === "string" && SUPPLIER_REQUEST_UUID.test(item.order_id)))) return invalid();
  if (item.status !== "draft" && (!item.construction_id || !item.quantity || !item.pack_purpose || !item.submitted_at)) return invalid();
  if ((item.status === "provisioned") !== Boolean(item.order_id) || (item.status === "draft" && item.submitted_at !== null)) return invalid();
  if(item.quotation_revision!==undefined&&(!Number.isSafeInteger(item.quotation_revision)||item.quotation_revision<0||item.quotation_revision>=item.revision))return invalid();
  if(item.quotation_revision!==undefined && (item.quotation_revision>0 ? !["offered","accepted","rejected","withdrawn"].includes(item.quotation_state) : item.quotation_state!==null))return invalid();
  const quoteMetadata=item.quotation_revision===undefined?{}:{quotation_revision:item.quotation_revision,quotation_state:item.quotation_state};
  let cancellation = {};
  if (item.status === "cancelled") {
    if (typeof item.cancellation_reason !== "string" || !item.cancellation_reason.trim() || item.cancellation_reason.length > 2000
      || typeof item.cancelled_by !== "string" || !SUPPLIER_REQUEST_UUID.test(item.cancelled_by) || !date(item.cancelled_at)
      || Date.parse(item.cancelled_at) !== Date.parse(item.updated_at) || Date.parse(item.cancelled_at) < Date.parse(item.submitted_at)) return invalid();
    cancellation = { cancellation_reason: item.cancellation_reason, cancelled_by: item.cancelled_by, cancelled_at: item.cancelled_at };
  } else if ([item.cancellation_reason, item.cancelled_by, item.cancelled_at].some(value => value !== undefined && value !== null)) return invalid();
  return { ...cancellation, ...quoteMetadata, id: item.id, tenant_id: item.tenant_id, tenant_slug: item.tenant_slug, status: item.status, revision: item.revision, title: item.title, construction_id: item.construction_id, quantity: item.quantity, pack_purpose: item.pack_purpose, notes: item.notes, created_at: item.created_at, updated_at: item.updated_at, submitted_at: item.submitted_at, order_id: item.order_id, ...(item.review_summary === undefined ? {} : { review_summary: parseSupplierRequestReviewSummary(item.review_summary) }) };
}
export type SupplierRequestInboxFilter = "all" | "draft" | "pending" | "needs_information" | "answered" | "provisioned" | "cancelled" | "unknown";
export function supplierRequestManagementState(item: SupplierRequest): Exclude<SupplierRequestInboxFilter, "all"> {
  return item.status === "submitted" ? item.review_summary?.state || "unknown" : item.status;
}
export function filterSupplierRequestInbox(items: SupplierRequest[], query: string, filter: SupplierRequestInboxFilter) {
  const search = query.trim().toLocaleLowerCase("es");
  return items.filter(item => (filter === "all" || supplierRequestManagementState(item) === filter) && (!search || [item.title, item.tenant_slug, item.id, item.construction_id].some(value => value.toLocaleLowerCase("es").includes(search))));
}
export function parseSupplierRequestEnvelope(payload: unknown, tenant: string, requestId?: string): SupplierRequestEnvelope {
  const { envelope, scope } = scopeOf(payload, tenant), request = parseSupplierRequestRecord(envelope.request, tenant);
  if ((requestId && request.id !== requestId) || (tenant && request.tenant_id !== scope.tenant_id)) return invalid();
  const raw = object(envelope.receipt);
  if (!raw) return { request };
  if (typeof raw.idempotency_key !== "string" || !SUPPLIER_REQUEST_UUID.test(raw.idempotency_key) || !["create", "patch", "submit"].includes(raw.action) || !revision(raw.revision) || raw.revision > request.revision || typeof envelope.idempotent_replay !== "boolean") return invalid();
  return { request, receipt: { idempotency_key: raw.idempotency_key, action: raw.action, revision: raw.revision }, idempotent_replay: envelope.idempotent_replay };
}
export function parseSupplierRequestList(payload: unknown, tenant: string) {
  const { envelope, scope } = scopeOf(payload, tenant);
  if (!Array.isArray(envelope.items) || envelope.items.length > 100 || envelope.count !== envelope.items.length || typeof envelope.truncated !== "boolean") return invalid();
  const items = envelope.items.map(item => parseSupplierRequestRecord(item, tenant));
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => tenant ? item.tenant_id !== scope.tenant_id : item.status === "draft")) return invalid();
  return { items, truncated: envelope.truncated as boolean };
}
export async function supplierRequestCall(input: { tenant: string; id?: string; command?: SupplierRequestCommand; signal?: AbortSignal }, fetcher: typeof fetch = fetch) {
  if ((input.tenant && !tenantPattern.test(input.tenant)) || (input.id && !SUPPLIER_REQUEST_UUID.test(input.id))) throw new SupplierRequestError("scope_invalid");
  const command = input.command;
  if (command && (!input.tenant || command.tenant !== input.tenant || command.id !== input.id || !SUPPLIER_REQUEST_UUID.test(command.key))) throw new SupplierRequestError("scope_invalid");
  const path = `/api/admin/supplier-requests${input.id ? `/${input.id}` : ""}${command?.action === "submit" ? "/submit" : ""}`;
  const controller = new AbortController(), abort = () => controller.abort();
  if (input.signal?.aborted) controller.abort(); else input.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20_000);
  try {
    const response = await fetcher(`${path}${input.tenant ? `?tenant=${encodeURIComponent(input.tenant)}` : ""}`, { method: command ? command.action === "patch" ? "PATCH" : "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal, headers: { Accept: "application/json", ...(command ? { "Content-Type": "application/json", "Idempotency-Key": command.key } : {}) }, ...(command ? { body: JSON.stringify(command.body) } : {}) });
    const text = await response.text();
    let body: any = null;
    const maximumResponseBytes = !command && !input.id ? 100 * 32 * 1024 : 64 * 1024;
    if (new TextEncoder().encode(text).byteLength <= maximumResponseBytes) { try { body = JSON.parse(text); } catch {} }
    if (!response.ok) {
      const certain = response.status < 500 && response.status !== 408 && object(body)?.ok === false && typeof body.reason === "string";
      throw new SupplierRequestError(certain ? body.reason : "unavailable", response.status, Boolean(command && !certain));
    }
    if (response.headers.get("x-nexid-data-mode") !== "production") throw new SupplierRequestError("contract_invalid", response.status, Boolean(command));
    try {
      if (!command && !input.id) return parseSupplierRequestList(body, input.tenant);
      const parsed = parseSupplierRequestEnvelope(body, input.tenant, input.id);
      if (command) {
        if (parsed.receipt?.idempotency_key !== command.key || parsed.receipt.action !== command.action) return invalid();
        const expectedReceiptRevision = command.action === "create" ? 1 : ("expected_revision" in command.body ? command.body.expected_revision + 1 : 0);
        if (parsed.receipt.revision !== expectedReceiptRevision) return invalid();
        if (parsed.receipt.revision === parsed.request.revision) {
          if (command.action === "submit" ? parsed.request.status !== "submitted" : parsed.request.status !== "draft" || Object.entries(command.body).some(([key, value]) => key !== "expected_revision" && parsed.request[key as keyof SupplierRequest] !== value)) return invalid();
        }
      }
      return parsed;
    } catch { throw new SupplierRequestError("contract_invalid", response.status, Boolean(command)); }
  } catch (error) {
    if (error instanceof SupplierRequestError) throw error;
    throw new SupplierRequestError("unavailable", 0, Boolean(command));
  } finally { clearTimeout(timer); input.signal?.removeEventListener("abort", abort); }
}
export function supplierRequestErrorCopy(error: SupplierRequestError) {
  if (error.uncertain) return "No se confirmó el guardado. Conservamos la misma operación para comprobar su resultado sin duplicarla.";
  if (["supplier_request_revision_conflict", "supplier_request_not_draft"].includes(error.code)) return "La solicitud cambió en otra sesión. Tus datos siguen aquí; consultá la versión actual antes de decidir qué conservar.";
  if (error.status === 401 || error.status === 403) return "Tu acceso no permite esta acción. Los datos escritos se conservan.";
  if (error.code === "supplier_request_incomplete") return "Completá construcción, cantidad y destino antes de enviar a NexID.";
  if (error.code === "supplier_request_secret_content_rejected") return "Retirá llaves, tokens u otros secretos del nombre o las notas antes de guardar. Tus datos siguen en el formulario.";
  return "No pudimos confirmar la operación. Conservamos tus datos. Revisá el acceso y volvé a consultar.";
}
