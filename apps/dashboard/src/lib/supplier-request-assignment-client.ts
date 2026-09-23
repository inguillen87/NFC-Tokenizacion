import { SupplierRequestError, SUPPLIER_REQUEST_UUID } from "./supplier-request-client";
export type SupplierRequestAssignment = { operator_id: string | null; revision: number; updated_at: string | null };
export type SupplierAssignmentEvent = { id: string; revision: number; request_revision: number; action: "assign" | "unassign"; operator_id: string | null; actor_id: string; created_at: string };
export type SupplierAssignmentEnvelope = { request_id: string; request_revision: number; assignment: SupplierRequestAssignment; history: SupplierAssignmentEvent[]; count: number; truncated: boolean; next_before_revision: number | null; receipt?: { idempotency_key: string; action: "assign" | "unassign"; revision: number }; idempotent_replay?: boolean };
export type SupplierAssignmentCommand = Readonly<{ tenant: string; id: string; key: string; body: Readonly<{ operator_id: string | null; expected_revision: number; expected_request_revision: number }> }>;
type Binding = { tenant: string; tenantId: string; id: string; beforeRevision?: number };
const object = (value: unknown): Record<string, any> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : null;
const int = (value: unknown, min = 1): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value < 2147483647;
const uuid = (value: unknown): value is string => typeof value === "string" && SUPPLIER_REQUEST_UUID.test(value);
const date = (value: unknown): value is string => typeof value === "string" && !!value && Number.isFinite(Date.parse(value));
const invalid = (): never => { throw new SupplierRequestError("contract_invalid"); };
function envelope(payload: unknown) { const data = object(payload); if (!data || data.ok !== true || data.protocol !== "nexid.supplier-request-assignment.v1" || data.demo === true || data.demoMode === true || data.dataSource === "demo") return invalid(); return data; }
export function parseSupplierOperators(payload: unknown) {
  const data = envelope(payload), scope = object(data.scope);
  if (!scope || scope.mode !== "global" || scope.tenant_id !== null || scope.tenant_slug !== null || !Array.isArray(data.operators) || data.operators.length > 100 || data.count !== data.operators.length || typeof data.truncated !== "boolean") return invalid();
  const operators = data.operators.map((raw: unknown): { id: string; display_name: string } => { const item = object(raw); if (!item || !uuid(item.id) || typeof item.display_name !== "string" || !item.display_name.trim()) return invalid(); return { id: item.id, display_name: item.display_name }; });
  if (new Set(operators.map(item => item.id)).size !== operators.length) return invalid();
  return { operators, truncated: data.truncated as boolean };
}
export function parseSupplierAssignment(payload: unknown, binding: Binding): SupplierAssignmentEnvelope {
  const data = envelope(payload), scope = object(data.scope), current = object(data.assignment);
  if (!scope || scope.mode !== "tenant" || scope.tenant_id !== binding.tenantId || scope.tenant_slug !== binding.tenant || data.request_id !== binding.id || !int(data.request_revision) || !current || !int(current.revision, 0) || !(current.operator_id === null || uuid(current.operator_id)) || (current.revision === 0 ? current.operator_id !== null || current.updated_at !== null : !date(current.updated_at))) return invalid();
  const upper = Math.min(current.revision, binding.beforeRevision === undefined ? current.revision : binding.beforeRevision - 1);
  if (!Array.isArray(data.history) || data.history.length !== Math.min(100, upper) || data.count !== data.history.length || typeof data.truncated !== "boolean") return invalid();
  let prior = 0; const ids = new Set<string>();
  const history = data.history.map((raw: unknown): SupplierAssignmentEvent => {
    const item = object(raw);
    if (!item || !uuid(item.id) || ids.has(item.id) || !int(item.revision) || item.revision > upper || (prior && item.revision !== prior + 1) || !int(item.request_revision) || item.request_revision > data.request_revision || !uuid(item.actor_id) || !date(item.created_at) || !(item.action === "assign" ? uuid(item.operator_id) : item.action === "unassign" && item.operator_id === null)) return invalid();
    prior = item.revision; ids.add(item.id); return { id: item.id, revision: item.revision, request_revision: item.request_revision, action: item.action, operator_id: item.operator_id, actor_id: item.actor_id, created_at: item.created_at };
  });
  if (upper && prior !== upper || data.truncated !== Boolean(history.length && history[0].revision > 1) || data.next_before_revision !== (data.truncated ? history[0].revision : null)) return invalid();
  if (binding.beforeRevision === undefined && history.length && (history.at(-1)!.operator_id !== current.operator_id || history.at(-1)!.created_at !== current.updated_at)) return invalid();
  const assignment: SupplierRequestAssignment = { operator_id: current.operator_id, revision: current.revision, updated_at: current.updated_at };
  const result: SupplierAssignmentEnvelope = { request_id: data.request_id, request_revision: data.request_revision, assignment, history, count: history.length, truncated: data.truncated, next_before_revision: data.next_before_revision };
  if (data.receipt !== undefined) { const receipt = object(data.receipt); if (!receipt || !uuid(receipt.idempotency_key) || !["assign", "unassign"].includes(receipt.action) || !int(receipt.revision) || receipt.revision > current.revision || typeof data.idempotent_replay !== "boolean") return invalid(); result.receipt = { idempotency_key: receipt.idempotency_key, action: receipt.action, revision: receipt.revision }; result.idempotent_replay = data.idempotent_replay; }
  return result;
}
async function call(path: string, command: SupplierAssignmentCommand | undefined, signal: AbortSignal | undefined, fetcher: typeof fetch) {
  const controller = new AbortController(), abort = () => controller.abort(); if (signal?.aborted) abort(); else signal?.addEventListener("abort", abort, { once: true }); const timer = setTimeout(abort, 20_000);
  try {
    const response = await fetcher(path, { method: command ? "POST" : "GET", cache: "no-store", credentials: "same-origin", signal: controller.signal, headers: { Accept: "application/json", ...(command ? { "Content-Type": "application/json", "Idempotency-Key": command.key } : {}) }, ...(command ? { body: JSON.stringify(command.body) } : {}) });
    const text = await response.text(); let body: any = null; if (new TextEncoder().encode(text).byteLength <= 512 * 1024) { try { body = JSON.parse(text); } catch {} }
    if (!response.ok) { const certain = response.status < 500 && response.status !== 408 && object(body)?.ok === false && typeof body.reason === "string"; throw new SupplierRequestError(certain ? body.reason : "unavailable", response.status, Boolean(command && !certain)); }
    if (response.headers.get("x-nexid-data-mode") !== "production") throw new SupplierRequestError("contract_invalid", response.status, Boolean(command)); return body;
  } catch (error) { if (error instanceof SupplierRequestError) throw error; throw new SupplierRequestError("unavailable", 0, Boolean(command)); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
export async function supplierOperatorsCall(signal?: AbortSignal, fetcher: typeof fetch = fetch) { return parseSupplierOperators(await call("/api/admin/supplier-requests/operators", undefined, signal, fetcher)); }
export async function supplierAssignmentCall(input: Binding & { command?: SupplierAssignmentCommand; signal?: AbortSignal }, fetcher: typeof fetch = fetch): Promise<SupplierAssignmentEnvelope> {
  const command = input.command;
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(input.tenant) || !uuid(input.tenantId) || !uuid(input.id) || (input.beforeRevision !== undefined && (!int(input.beforeRevision) || command)) || (command && (command.tenant !== input.tenant || command.id !== input.id || !uuid(command.key) || !(command.body.operator_id === null || uuid(command.body.operator_id)) || !int(command.body.expected_revision, 0) || !int(command.body.expected_request_revision)))) throw new SupplierRequestError("scope_invalid");
  const body = await call(`/api/admin/supplier-requests/${input.id}/assignment?tenant=${encodeURIComponent(input.tenant)}${input.beforeRevision !== undefined ? `&before_revision=${input.beforeRevision}` : ""}`, command, input.signal, fetcher);
  try {
    const result = parseSupplierAssignment(body, input);
    if (command) { const receipt = result.receipt; if (!receipt || receipt.idempotency_key !== command.key || receipt.action !== (command.body.operator_id ? "assign" : "unassign") || receipt.revision !== command.body.expected_revision + 1 || result.request_revision < command.body.expected_request_revision) return invalid(); const event = result.history.find(item => item.revision === receipt.revision); if (event && (event.operator_id !== command.body.operator_id || event.request_revision !== command.body.expected_request_revision)) return invalid(); }
    return result;
  } catch { throw new SupplierRequestError("contract_invalid", 200, Boolean(command)); }
}
