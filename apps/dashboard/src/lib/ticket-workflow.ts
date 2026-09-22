import { readTicketResponse } from "./ticket-request-deadline";
import { canonicalTicketReference } from "./ticket-reference-lookup";

export type TicketStatus = "open" | "pending" | "closed";
export type WorkflowCurrent = { ticketId: string; tenantId: string | null; tenantSlug: string | null; status: string; revision: string; updatedAt: string; canUpdate: boolean; blockedReason: "incident_managed" | "legacy_status" | "tenant_unassigned" | null };
export type WorkflowItem = { operationId: string; requestId: string; sequence: string; fromStatus: string; toStatus: TicketStatus; reason: string; actor: { id: string; label: string | null }; createdAt: string; revision: string };
export type WorkflowHistory = { current: WorkflowCurrent; items: WorkflowItem[]; page: { hasMore: boolean; nextCursor: string | null } };
export type WorkflowCommand = Readonly<{ status: TicketStatus; reason: string; request_id: string; expected_revision: string }>;
export type WorkflowOutcome = { status: "saved"; current: WorkflowCurrent; receipt: WorkflowItem } | { status: "conflict" | "blocked" | "forbidden" | "rejected" | "uncertain" };
const statuses = ["open", "pending", "closed"];
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, maximum: number): value is string => typeof value === "string" && value.length <= maximum;
const nullableText = (value: unknown, maximum: number) => value === null || text(value, maximum);
const date = (value: unknown): value is string => text(value, 64) && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value));
const sequence = (value: unknown): value is string => text(value, 19) && /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n;

function currentFromEnvelope(payload: unknown, reference: string, tenant: string): WorkflowCurrent | null {
  const body = object(payload), scope = object(body?.scope), current = object(body?.current);
  if (body?.ok !== true || body.protocol !== "nexid.support-ticket-workflow.v1" || body.demoMode === true || body.dataSource === "demo" || !scope || !current
    || current.ticketId !== reference || !canonicalTicketReference(reference) || !text(current.status, 64) || !digest(current.revision)
    || !date(current.updatedAt) || typeof current.canUpdate !== "boolean" || ![null, "incident_managed", "legacy_status", "tenant_unassigned"].includes(current.blockedReason as null)
    || !nullableText(current.tenantId, 128) || !nullableText(current.tenantSlug, 128)) return null;
  if (tenant ? scope.mode !== "tenant" || scope.tenantSlug !== tenant || current.tenantSlug !== tenant || !canonicalTicketReference(scope.tenantId) || current.tenantId !== scope.tenantId
    : scope.mode !== "global" || scope.tenantId !== null || scope.tenantSlug !== null) return null;
  if (current.canUpdate && (current.blockedReason !== null || !statuses.includes(current.status) || !canonicalTicketReference(current.tenantId) || !current.tenantSlug)) return null;
  return current as unknown as WorkflowCurrent;
}

function historyItem(value: unknown): WorkflowItem | null {
  const item = object(value), actor = object(item?.actor);
  if (!item || !actor || !canonicalTicketReference(item.operationId) || !canonicalTicketReference(item.requestId) || !sequence(item.sequence)
    || !text(item.fromStatus, 64) || !statuses.includes(String(item.toStatus)) || !text(item.reason, 1000) || !item.reason.trim()
    || !canonicalTicketReference(actor.id) || !nullableText(actor.label, 320) || !date(item.createdAt) || !digest(item.revision)) return null;
  return item as unknown as WorkflowItem;
}

export function parseWorkflowHistory(payload: unknown, reference: string, tenant: string): WorkflowHistory | null {
  const current = currentFromEnvelope(payload, reference, tenant), body = object(payload), page = object(body?.page);
  if (!current || !page || typeof page.hasMore !== "boolean" || !Array.isArray(body?.items) || body.items.length > 50
    || (page.hasMore ? !sequence(page.nextCursor) : page.nextCursor !== null)) return null;
  const items = body.items.map(historyItem);
  if (items.some(item => !item)) return null;
  const valid = items as WorkflowItem[];
  if (valid.some((item, index) => index > 0 && BigInt(valid[index - 1].sequence) <= BigInt(item.sequence))
    || new Set(valid.map(item => item.operationId)).size !== valid.length
    || (page.hasMore && (!valid.length || page.nextCursor !== valid.at(-1)?.sequence))) return null;
  return { current, items: valid, page: page as WorkflowHistory["page"] };
}

export function prepareWorkflowCommand(current: WorkflowCurrent, status: string, reason: string, requestId: string): WorkflowCommand | null {
  const normalized = reason.replace(/[\r\n\t]+/g, " ").trim();
  if (!current.canUpdate || !digest(current.revision) || !statuses.includes(status) || status === current.status || !normalized || normalized.length > 1000 || /[\u0000-\u001f\u007f-\u009f]/.test(normalized) || !canonicalTicketReference(requestId)) return null;
  return Object.freeze({ status: status as TicketStatus, reason: normalized, request_id: requestId.toLowerCase(), expected_revision: current.revision });
}

export function createTicketWorkflowReader(reference: string, tenant: string, fetcher: typeof fetch = fetch) {
  let generation = 0;
  let controller: AbortController | null = null;
  function cancel() { generation += 1; controller?.abort(); }
  return {
    cancel,
    async read(cursor?: string): Promise<{ status: "ready"; history: WorkflowHistory } | { status: "unavailable" | "forbidden" } | null> {
      cancel();
      const ownGeneration = generation;
      controller = new AbortController();
      const ownController = controller;
      try {
        const query = new URLSearchParams();
        if (tenant) query.set("tenant", tenant);
        if (cursor) query.set("cursor", cursor);
        const { response, body } = await readTicketResponse(fetcher, `/api/admin/tickets/${reference}/history${query.size ? `?${query}` : ""}`, {
          method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", signal: ownController.signal, headers: { Accept: "application/json" },
        }, ownController);
        if (generation !== ownGeneration) return null;
        if (response.status === 401 || response.status === 403) return { status: "forbidden" };
        const history = response.ok && response.headers.get("x-nexid-data-mode") === "production" ? parseWorkflowHistory(body, reference, tenant) : null;
        return history ? { status: "ready", history } : { status: "unavailable" };
      } catch { return generation === ownGeneration ? { status: "unavailable" } : null; }
    },
  };
}

export function receiptMatchesCommand(receipt: WorkflowItem, command: WorkflowCommand, fromStatus: string) {
  return receipt.requestId === command.request_id && receipt.fromStatus === fromStatus && receipt.toStatus === command.status && receipt.reason === command.reason;
}

export function parseWorkflowOutcome(status: number, payload: unknown, reference: string, tenant: string, command: WorkflowCommand, fromStatus: string, dataMode: string | null): WorkflowOutcome {
  if (status === 401 || status === 403) return { status: "forbidden" };
  const body = object(payload);
  if (dataMode !== "production") return { status: "uncertain" };
  if (status === 409 && body?.ok === false && body.reason === "ticket_workflow_conflict") return { status: "conflict" };
  if (status === 409 && body?.ok === false && body.reason === "ticket_workflow_blocked") return { status: "blocked" };
  if (status === 400 && body?.ok === false && ["ticket_workflow_no_change", "ticket_workflow_invalid_request"].includes(String(body.reason))) return { status: "rejected" };
  const current = currentFromEnvelope(payload, reference, tenant), receipt = historyItem(body?.receipt);
  if (status < 200 || status >= 300 || !current || !receipt || !["updated", "replayed"].includes(String(body?.outcome)) || !receiptMatchesCommand(receipt, command, fromStatus)) return { status: "uncertain" };
  return { status: "saved", current, receipt };
}

/** Keeps the reviewed command immutable across uncertain retries, including later auth failures. */
export function createTicketWorkflowWriter(reference: string, tenant: string, fetcher: typeof fetch = fetch) {
  let attempt: { command: WorkflowCommand; fromStatus: string } | null = null;
  let unresolved = false, busy = false, generation = 0;
  let controller: AbortController | null = null;
  return {
    prepare(current: WorkflowCurrent, status: string, reason: string, requestId: string) {
      if (busy || unresolved) return null;
      const command = prepareWorkflowCommand(current, status, reason, requestId);
      attempt = command ? { command, fromStatus: current.status } : null;
      return command;
    },
    canEdit: () => !busy && !unresolved,
    isBusy: () => busy,
    getAttempt: () => attempt,
    clear() { if (!busy && !unresolved) attempt = null; },
    isUnresolved: () => unresolved,
    reconcile(history: WorkflowHistory) {
      const found = attempt && history.items.find(item => receiptMatchesCommand(item, attempt!.command, attempt!.fromStatus));
      if (found) unresolved = false;
      return found || null;
    },
    dispose() { generation += 1; controller?.abort(); },
    async submit(): Promise<WorkflowOutcome | null> {
      if (!attempt || busy) return null;
      busy = true;
      const ownGeneration = generation;
      const frozen = attempt;
      controller = new AbortController();
      const ownController = controller;
      try {
        const query = tenant ? `?${new URLSearchParams({ tenant })}` : "";
        const { response, body } = await readTicketResponse(fetcher, `/api/admin/tickets/${reference}${query}`, {
          method: "PATCH", cache: "no-store", credentials: "same-origin", redirect: "error", signal: ownController.signal,
          headers: { "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": frozen.command.request_id },
          body: JSON.stringify(frozen.command),
        }, ownController);
        if (generation !== ownGeneration) return null;
        const outcome = parseWorkflowOutcome(response.status, body, reference, tenant, frozen.command, frozen.fromStatus, response.headers.get("x-nexid-data-mode"));
        if (outcome.status === "saved") unresolved = false;
        else if (outcome.status === "uncertain") unresolved = true;
        return outcome;
      } catch {
        if (generation !== ownGeneration) return null;
        unresolved = true;
        return { status: "uncertain" };
      } finally { if (generation === ownGeneration) busy = false; }
    },
  };
}
